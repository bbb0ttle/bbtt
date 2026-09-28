import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const JF = process.env.JF_URL ?? "http://localhost:8096";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/bbtt/",
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    proxy: {
      "^/(?!bbtt/|@|src/|node_modules/|$).*": { target: JF, changeOrigin: true, ws: true },
    },
  },
});
