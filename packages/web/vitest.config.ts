import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    environment: "node",
    environmentMatchGlobs: [["test/**/*.test.tsx", "happy-dom"]],
    setupFiles: ["test/setup.ts"]
  }
});
