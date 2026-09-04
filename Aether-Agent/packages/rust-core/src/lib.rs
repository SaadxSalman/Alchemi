//! Aether-Agent AI core library.
//!
//! The binary (`main.rs`) exposes an Axum HTTP service; everything
//! reusable lives here so it can be unit-tested and imported by tools.

pub mod processor;
pub mod vision;

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
