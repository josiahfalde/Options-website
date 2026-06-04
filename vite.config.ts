import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base + HashRouter keeps the SPA working everywhere:
// GitHub Pages project subpath, a custom domain, or opened locally.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
