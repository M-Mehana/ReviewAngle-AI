import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], testTimeout: 30000 },
  resolve: {
    alias: {
      "server-only": new URL("./tests/server-only.ts", import.meta.url)
        .pathname,
    },
  },
});
