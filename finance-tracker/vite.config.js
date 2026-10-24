import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // the legal texts live in ../docs/legal, outside this folder
  server: { fs: { allow: [".."] } },
});
