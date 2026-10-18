import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api is proxied to the backend in dev, so cookies stay same-origin (no CORS needed).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:4000" } },
});
