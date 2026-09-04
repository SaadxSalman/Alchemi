//! Crisis classification — maps satellite image statistics to a verdict.

use crate::vision::model::ImageFeatures;

#[derive(Debug, Clone)]
pub struct CrisisVerdict {
    pub severity: f32,
    pub crisis_type: String,
    pub confidence: f32,
}

fn fnv1a(bytes: &[u8]) -> u32 {
    let mut hash: u32 = 2166136261;
    for &b in bytes {
        hash ^= u32::from(b);
        hash = hash.wrapping_mul(16777619);
    }
    hash
}

impl CrisisVerdict {
    /// Deterministic URL-hash fallback used when the image can't be
    /// fetched/decoded (offline dev, dead link). Same contract as the
    /// Node-side mock so the pipeline behaves identically either way.
    pub fn fallback_for(url: &str) -> Self {
        let h = fnv1a(url.as_bytes());
        let crisis_types = ["Flood", "Wildfire", "Earthquake", "Landslide", "Hurricane"];
        let severity = 0.45 + ((h % 40) as f32 / 100.0);
        let confidence = 0.72 + ((h % 20) as f32 / 100.0);
        Self {
            severity: severity.min(0.99),
            crisis_type: crisis_types[(h as usize) % crisis_types.len()].to_string(),
            confidence: confidence.min(0.99),
        }
    }
}

/// Maps satellite image statistics to a crisis classification.
///
/// Heuristics (informed by how disasters look from orbit):
///  * Flood      — large dark, blue-dominant regions
///  * Wildfire   — red/burnt dominance with little vegetation
///  * Drought    — bright, barren terrain, almost no vegetation
///  * Landslide  — earth tones combined with high texture variance
///  * Earthquake — grey rubble tones with extreme texture variance
pub fn classify(features: &ImageFeatures) -> CrisisVerdict {
    let ImageFeatures {
        brightness,
        blue_ratio,
        green_ratio,
        red_ratio,
        variance,
    } = *features;

    let flood = blue_ratio * 1.5 + (1.0 - brightness) * 0.5;
    let wildfire = red_ratio * 1.4 + (1.0 - green_ratio) * 0.6;
    let drought = brightness * 0.8 + (1.0 - green_ratio) * 0.8 - blue_ratio;
    let landslide = red_ratio * 0.7 + variance * 1.2;
    let earthquake = variance * 1.5 + (1.0 - blue_ratio) * 0.3;

    let mut scores = [
        ("Flood", flood),
        ("Wildfire", wildfire),
        ("Drought", drought),
        ("Landslide", landslide),
        ("Earthquake", earthquake),
    ];
    scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let (best_type, best_score) = scores[0];
    let runner_up = scores[1].1.max(1e-6);

    // Severity tracks the raw damage signal; confidence grows with the
    // margin between the winner and the runner-up class.
    let severity = (0.35 + best_score * 0.45).clamp(0.1, 0.99);
    let margin = ((best_score - runner_up) / best_score.abs().max(1e-6)).clamp(0.0, 1.0);
    let confidence = 0.6 + margin * 0.35;

    CrisisVerdict {
        severity,
        crisis_type: best_type.to_string(),
        confidence,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn water_dominated_images_classify_as_flood() {
        let features = ImageFeatures {
            brightness: 0.2,
            blue_ratio: 0.7,
            green_ratio: 0.05,
            red_ratio: 0.02,
            variance: 0.1,
        };
        assert_eq!(classify(&features).crisis_type, "Flood");
    }

    #[test]
    fn dry_bright_images_classify_as_drought() {
        let features = ImageFeatures {
            brightness: 0.9,
            blue_ratio: 0.0,
            green_ratio: 0.01,
            red_ratio: 0.05,
            variance: 0.05,
        };
        assert_eq!(classify(&features).crisis_type, "Drought");
    }

    #[test]
    fn fallback_is_deterministic() {
        let a = CrisisVerdict::fallback_for("https://example.com/flood.png");
        let b = CrisisVerdict::fallback_for("https://example.com/flood.png");
        assert_eq!(a.crisis_type, b.crisis_type);
        assert!((a.severity - b.severity).abs() < f32::EPSILON);
        assert!((a.confidence - b.confidence).abs() < f32::EPSILON);
    }
}