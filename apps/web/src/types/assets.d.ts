/**
 * Ambient module declarations for non-code assets.
 *
 * Next.js normally provides these typings transitively, but TypeScript 7+
 * no longer resolves them for plain side-effect imports (e.g. globals.css),
 * so we declare them here explicitly. Both TS 5.x and 7.x are satisfied.
 */
declare module "*.css";