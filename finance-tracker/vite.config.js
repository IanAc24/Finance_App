import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // the legal texts live in ../docs/legal, outside this folder
  server: { fs: { allow: [".."] } },
  // the browser tests in e2e/ are run by Playwright (npm run e2e), not Vitest;
  // the real-Firebase suites (qa-firebase/) only run with npm run qa:firebase
  test: { exclude: ["**/node_modules/**", "**/dist/**", "e2e/**", "qa-firebase/**"] },
});
