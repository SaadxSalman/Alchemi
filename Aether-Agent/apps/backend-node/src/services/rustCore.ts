import dotenv from 'dotenv';

dotenv.config();

const RUST_CORE_URL = process.env.RUST_CORE_URL ?? 'http://localhost:50051';

export interface RustAnalysisResult {
  severity: number; // 0.0 - 1.0
  crisis_type: string;
  confidence?: number;
}

/**
 * Calls the rust-core (Axum) service to run vision analysis
 * on a satellite image. Falls back to mock data if rust-core
 * is not running — this lets you develop the UI end-to-end.
 */
export async function analyzeSatelliteImage(
  imageUrl: string
): Promise<RustAnalysisResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${RUST_CORE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Rust-core responded ${response.status}`);
    }

    return (await response.json()) as RustAnalysisResult;
  } catch (err) {
    console.warn(
      `[rust-core] unreachable at ${RUST_CORE_URL} — ` +
        `falling back to mock analysis. Reason: ${
          err instanceof Error ? err.message : String(err)
        }`
    );

    // Deterministic mock so FE/BE development proceeds without Rust running.
    const mockTypes = ['Flood', 'Wildfire', 'Earthquake', 'Landslide'];
    const rand = hashString(imageUrl);
    return {
      severity: +(0.4 + (rand % 45) / 100).toFixed(2),
      crisis_type: mockTypes[rand % mockTypes.length],
      confidence: +(0.75 + (rand % 20) / 100).toFixed(2),
    };
  }
}

/** Simple FNV-1a hash so the same URL always produces same mock result */
function hashString(s: string): number {
  let h =  0x811c9dc5;
  for (let i =  0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h,  0x01000193);
  }
  return h >>>  0;
}
