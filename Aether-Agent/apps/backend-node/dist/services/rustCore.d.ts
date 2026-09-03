export interface RustAnalysisResult {
    severity: number;
    crisis_type: string;
    confidence?: number;
}
/**
 * Calls the rust-core (Axum) service to run vision analysis
 * on a satellite image. Falls back to mock data if rust-core
 * is not running — this lets you develop the UI end-to-end.
 */
export declare function analyzeSatelliteImage(imageUrl: string): Promise<RustAnalysisResult>;
//# sourceMappingURL=rustCore.d.ts.map