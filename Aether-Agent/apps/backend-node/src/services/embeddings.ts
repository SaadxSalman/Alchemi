/**
 * Deterministic embedding utilities for the multi-modal crisis memory.
 *
 * In production these vectors would come from a real Vision Transformer
 * (images) and a sentence-transformer (text). Here we derive stable
 * 768-dimension vectors from an FNV-1a seeded PRNG so identical inputs always
 * map to the same point in the embedding space — enough to demonstrate real
 * similarity search end-to-end (e.g. "flood damage" lands near previously
 * stored flood crises) without shipping multi-GB model weights.
 */

export const EMBEDDING_DIM = 768;

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 — tiny, fast, fully deterministic PRNG. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function normalize(vec: number[]): number[] {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

/**
 * Embeds free text (news reports, social posts, analysis summaries).
 * Shared tokens produce correlated vectors, so semantically overlapping
 * reports end up close together in Milvus' L2 space.
 */
export function embedText(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  const tokens = tokenize(text);
  const bag = tokens.length > 0 ? tokens : ['unknown'];

  for (const token of bag) {
    const rand = prng(fnv1a(token));
    // Each token contributes a stable random projection across all dims.
    for (let d = 0; d < EMBEDDING_DIM; d++) {
      vec[d] += rand() - 0.5;
    }
  }

  return normalize(vec);
}

/**
 * Embeds a satellite image. Until the ViT weights are wired into rust-core,
 * the image is represented by its URL + detected crisis label — stable for
 * identical inputs, which keeps insert/search behaviour deterministic.
 */
export function embedImage(imageUrl: string, crisisType: string): number[] {
  return embedText(`satellite image ${imageUrl} ${crisisType}`);
}