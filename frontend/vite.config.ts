import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-ignore
import { authDevPlugin } from "./authDevPlugin.js";

export default defineConfig({
  plugins: [react(), authDevPlugin()],
  server: {
    port: 5173,
    proxy: {
          "/api": {
            target: "http://127.0.0.1:8000",   // <-- Replace this URL with your Render backend URL
            changeOrigin: true,
          },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
        },
      },
    },
  },
});

