import dotenv from 'dotenv';

dotenv.config();

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? 'http://127.0.0.1:8899';
const SOLANA_PROGRAM_ID =
  process.env.SOLANA_PROGRAM_ID ?? 'G4sskGCCr4asC6Am8saezpvYJFhqR2aF79Q4625w3Pnd';

export interface CrisisOnChain {
  authority: string;
  crisisType: string;
  severity: number;
  timestamp: number;
  signature?: string;
}

/**
 * Solana coordination service.
 * Uses the JSON-RPC API directly so no heavy SDK is required.
 * When a local validator is not running, methods return a
 * simulated signature so the rest of the stack stays testable.
 */
export class SolanaService {
  private readonly rpcUrl: string;
  private readonly programId: string;

  constructor(rpcUrl: string = SOLANA_RPC_URL, programId: string = SOLANA_PROGRAM_ID) {
    this.rpcUrl = rpcUrl;
    this.programId = programId;
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Solana RPC HTTP ${res.status}`);
      const json = (await res.json()) as { result?: T; error?: { message: string } };
      if (json.error) throw new Error(json.error.message);
      return json.result as T;
    } catch (err) {
      console.warn(
        `[solana] unreachable at ${this.rpcUrl} — ` +
          `on-chain coordination unavailable. Reason: ${
            err instanceof Error ? err.message : String(err)
          }`
      );
      throw err;
    }
  }

  async getHealth(): Promise<string> {
    return this.rpc<string>('getHealth', []);
  }

  /**
   * Records a crisis on-chain. In production this would build and
   * submit a real transaction to the Anchor program. For local
   * development without a validator, we return a simulated signature.
   */
  async reportCrisis(crisis: Omit<CrisisOnChain, 'timestamp' | 'signature'>): Promise<CrisisOnChain> {
    const timestamp = Math.floor(Date.now() / 1000);

    try {
      await this.getHealth();
      // Real implementation would call the Anchor program here.
      // For now we simulate a signature derived from the inputs.
      const signature = `sim_${Buffer.from(
        `${crisis.authority}:${crisis.crisisType}:${crisis.severity}:${timestamp}`
      )
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 32)}`;

      return { ...crisis, timestamp, signature };
    } catch {
      // Validator not running — simulate for dev/test.
      return {
        ...crisis,
        timestamp,
        signature: `sim_${Date.now().toString(36)}`,
      };
    }
  }

  get programAddress(): string {
    return this.programId;
  }
}

export const solana = new SolanaService();
