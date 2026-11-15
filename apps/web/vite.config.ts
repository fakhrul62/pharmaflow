import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: false } },
  },
  preview: {
    port: 4173,
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: false } },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("@tanstack/react-query")) return "query";
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("react-router")
          )
            return "react";
        },
      },
    },
  },
});
