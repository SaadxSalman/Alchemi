import dotenv from 'dotenv';

dotenv.config();

/**
 * Milvus' RESTful v2 API is served on its HTTP port (9091 in the bundled
 * docker-compose), not on the gRPC port 19530.
 */
const MILVUS_URL = process.env.MILVUS_URL ?? 'http://localhost:9091';

export interface CrisisEmbeddingInput {
  imageVector: number[];
  textVector: number[];
  crisisType: string;
  source: string;
}

export interface SimilarMatch {
  id: string;
  distance: number;
  crisisType: string;
  source: string;
}

/**
 * Milvus client for the multi-modal crisis embedding space.
 *
 * Uses the RESTful v2 API so no extra SDK dependency is required. Every
 * method throws on failure and callers wrap them in try/catch, so the rest
 * of the stack keeps working when Milvus is offline.
 */
export class MilvusClient {
  private readonly baseUrl: string;
  private readonly collection = 'crisis_embeddings';

  constructor(baseUrl: string = MILVUS_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(
    path: string,
    body?: Record<string, unknown>,
    method: 'POST' | 'GET' = 'POST'
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Milvus HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      throw new Error(
        `[milvus] ${path} failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /** Liveness probe against the Milvus HTTP health endpoint. */
  async isAlive(): Promise<boolean> {
    try {
      await this.request<{ status?: string }>('/healthz', undefined, 'GET');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Creates the multi-modal collection: satellite image vector + report text
   * vector + scalar metadata, each vector field with its own L2 index.
   * Safe to call on every boot — creating an existing collection just
   * reports an error which we swallow.
   */
  async ensureCollection(): Promise<void> {
    try {
      await this.request('/v2/vectordb/collections/create', {
        collectionName: this.collection,
        schema: {
          autoId: true,
          fields: [
            { fieldName: 'id', dataType: 'Int64', isPrimary: true },
            {
              fieldName: 'image_vector',
              dataType: 'FloatVector',
              elementTypeParams: { dim: '768' },
            },
            {
              fieldName: 'text_vector',
              dataType: 'FloatVector',
              elementTypeParams: { dim: '768' },
            },
            {
              fieldName: 'crisis_type',
              dataType: 'VarChar',
              elementTypeParams: { max_length: '64' },
            },
            {
              fieldName: 'source',
              dataType: 'VarChar',
              elementTypeParams: { max_length: '64' },
            },
          ],
        },
        indexParams: [
          {
            fieldName: 'image_vector',
            indexName: 'image_vec_idx',
            metricType: 'L2',
          },
          {
            fieldName: 'text_vector',
            indexName: 'text_vec_idx',
            metricType: 'L2',
          },
        ],
      });
      console.log(`✅ Milvus collection "${this.collection}" ready`);
    } catch {
      // Collection (or server) may already exist / be offline — non-fatal.
    }
  }

  async insert(data: CrisisEmbeddingInput): Promise<void> {
    await this.request('/v2/vectordb/entities/insert', {
      collectionName: this.collection,
      data: [
        {
          image_vector: data.imageVector,
          text_vector: data.textVector,
          crisis_type: data.crisisType,
          source: data.source,
        },
      ],
    });
  }

  private async search(
    annsField: 'image_vector' | 'text_vector',
    vector: number[],
    limit: number
  ): Promise<SimilarMatch[]> {
    const res = await this.request<{ data?: Array<Record<string, unknown>> }>(
      '/v2/vectordb/entities/search',
      {
        collectionName: this.collection,
        annsField,
        data: [vector],
        limit,
        outputFields: ['crisis_type', 'source'],
      }
    );

    return (res.data ?? []).map((row, i) => ({
      id: String(row['id'] ?? i),
      distance: Number(row['distance'] ?? 0),
      crisisType: String(row['crisis_type'] ?? 'Unknown'),
      source: String(row['source'] ?? 'unknown'),
    }));
  }

  searchImage(vector: number[], limit = 5): Promise<SimilarMatch[]> {
    return this.search('image_vector', vector, limit);
  }

  searchText(vector: number[], limit = 5): Promise<SimilarMatch[]> {
    return this.search('text_vector', vector, limit);
  }
}

export const milvus = new MilvusClient();