import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";


export default defineConfig({
  // Public base path for the app. Allows root ("/") and scoped builds (e.g., "/b/BUILD_ID/").
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3200",
        changeOrigin: true
      }
    }
  }
});
