import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = process.env.ARISE_BACKEND ?? "http://127.0.0.1:8001";

export default defineConfig({
  plugins: [react()],
  envPrefix: ["VITE_", "REACT_APP_"],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    proxy: { "/api": backend, "/s/": backend },
  },
  build: { outDir: "build", sourcemap: false, chunkSizeWarningLimit: 900 },
});
