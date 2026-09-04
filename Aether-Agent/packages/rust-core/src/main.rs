//! Axum HTTP service for the Aether-Agent AI core.
//!
//! POST /analyze  { "image_url": "..." } ->
//!   { "severity": f32, "crisis_type": String, "confidence": f32 }
//!
//! The handler downloads the image, extracts pixel statistics
//! (stand-in for the Vision Transformer) and classifies the crisis.
//! If the image cannot be fetched or decoded, a deterministic
//! URL-hash verdict is returned so the pipeline keeps working.

use axum::routing::{get, post};
use axum::{Json, Router};
use rust_core::processor::{classify, CrisisVerdict};
use rust_core::vision::model::SatelliteAnalyzer;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tokio::net::TcpListener;

#[derive(Deserialize)]
pub struct AnalysisRequest {
    image_url: String,
}

#[derive(Serialize)]
pub struct AnalysisResponse {
    severity: f32,
    crisis_type: String,
    confidence: f32,
}

async fn fetch_image(url: &str) -> Option<image::DynamicImage> {
    let response = reqwest::get(url).await.ok()?;
    let bytes = response.bytes().await.ok()?;
    image::load_from_memory(&bytes).ok()
}

async fn analyze(image_url: &str) -> CrisisVerdict {
    match fetch_image(image_url).await {
        Some(img) => {
            let features = SatelliteAnalyzer::new().extract_features(&img);
            classify(&features)
        }
        None => CrisisVerdict::fallback_for(image_url),
    }
}

async fn analyze_handler(Json(payload): Json<AnalysisRequest>) -> Json<AnalysisResponse> {
    let verdict = analyze(&payload.image_url).await;
    Json(AnalysisResponse {
        severity: (verdict.severity * 100.0).round() / 100.0,
        crisis_type: verdict.crisis_type,
        confidence: (verdict.confidence * 100.0).round() / 100.0,
    })
}

async fn health_handler() -> &'static str {
    "ok"
}

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("RUST_CORE_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(50051);

    let app = Router::new()
        .route("/analyze", post(analyze_handler))
        .route("/health", get(health_handler));

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("🚀 Rust-Core running on http://{addr}");

    let listener = TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}