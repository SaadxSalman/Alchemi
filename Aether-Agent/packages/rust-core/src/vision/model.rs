//! Satellite imagery feature extraction.
//!
//! This is the pure-Rust stand-in for the Vision Transformer: instead of
//! running a fine-tuned ViT, we compute the statistics a trained model
//! would attend to — luminance, colour dominance and local contrast —
//! directly from the decoded image. Swapping in real ViT weights later
//! only requires replacing `extract_features`.

use image::{DynamicImage, GenericImageView};

/// Raw statistics extracted from a satellite image.
#[derive(Debug, Clone, Copy)]
pub struct ImageFeatures {
    pub brightness: f32, // 0..1 mean luminance
    pub blue_ratio: f32, // fraction of "water-like" pixels
    pub green_ratio: f32, // fraction of "vegetation-like" pixels
    pub red_ratio: f32,  // fraction of "burnt/earth-like" pixels
    pub variance: f32,   // texture chaos 0..1 — rubble, debris, edges
}

pub struct SatelliteAnalyzer {
    // In a full deployment the ViT weights would be loaded here.
}

impl Default for SatelliteAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

impl SatelliteAnalyzer {
    pub fn new() -> Self {
        Self {}
    }

    /// Extracts features from a decoded satellite image.
    pub fn extract_features(&self, img: &DynamicImage) -> ImageFeatures {
        // Downscale huge satellite tiles for stable, fast statistics.
        let small = img.resize_exact(64, 64, image::imageops::FilterType::Triangle);

        let mut brightness_sum = 0.0_f32;
        let mut blue = 0.0_f32;
        let mut green = 0.0_f32;
        let mut red = 0.0_f32;
        let mut samples: Vec<f32> = Vec::with_capacity(4096);

        for (_x, _y, pixel) in small.pixels() {
            let r = f32::from(pixel[0]) / 255.0;
            let g = f32::from(pixel[1]) / 255.0;
            let b = f32::from(pixel[2]) / 255.0;
            let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            brightness_sum += luminance;
            samples.push(luminance);

            if b > r * 1.15 && b > g * 1.15 {
                blue += 1.0;
            }
            if g > r * 1.1 && g > b * 1.1 {
                green += 1.0;
            }
            if r > g * 1.2 && r > b * 1.2 {
                red += 1.0;
            }
        }

        let n = (small.width() * small.height()).max(1) as f32;
        let mean = brightness_sum / n;

        let variance = if samples.is_empty() {
            0.0
        } else {
            let var = samples
                .iter()
                .map(|s| (s - mean).powi(2))
                .sum::<f32>()
                / samples.len() as f32;
            // Pixel variance is tiny in practice; rescale into 0..1.
            (var * 4.0).min(1.0)
        };

        ImageFeatures {
            brightness: mean.clamp(0.0, 1.0),
            blue_ratio: blue / n,
            green_ratio: green / n,
            red_ratio: red / n,
            variance,
        }
    }

    /// Damage score (0.0 – 1.0) computed straight from raw image bytes.
    pub async fn detect_damage(&self, image_data: Vec<u8>) -> Result<f32, String> {
        let img = image::load_from_memory(&image_data).map_err(|e| e.to_string())?;
        let features = self.extract_features(&img);
        Ok(((1.0 - features.brightness) * 0.5 + features.variance * 0.5).clamp(0.0, 1.0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uniform_blue_image_has_high_blue_ratio() {
        let img = DynamicImage::new_rgb8(32, 32);
        let mut filled = img.to_rgb8();
        for pixel in filled.pixels_mut() {
            *pixel = image::Rgb([30, 60, 220]);
        }
        let img = DynamicImage::from(filled);
        let features = SatelliteAnalyzer::new().extract_features(&img);
        assert!(features.blue_ratio > 0.9);
        assert!(features.brightness < 0.5);
    }
}