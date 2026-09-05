/**
 * Next.js configuration for the Alchemi laboratory dashboard.
 *
 * Secrets/env live in `venv/.env` (git-ignored). We load it here at
 * build/start time and expose only NEXT_PUBLIC_* values to the browser.
 */
const path = require("path");
const fs = require("fs");

function loadEnvFile(file) {
  if (fs.existsSync(file)) {
    require("dotenv").config({ path: file, override: false });
  }
}

loadEnvFile(path.resolve(__dirname, "../../venv/.env")); // recommended secrets home
loadEnvFile(path.resolve(__dirname, ".env.local"));
loadEnvFile(path.resolve(__dirname, "../../.env"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000",
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "Alchemi",
    NEXT_PUBLIC_ALCHEMI_API_KEY: process.env.NEXT_PUBLIC_ALCHEMI_API_KEY || "",
  },
};

module.exports = nextConfig;
