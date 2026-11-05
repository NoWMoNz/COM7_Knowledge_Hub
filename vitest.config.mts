import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  // "server-only" throws outside the Next server bundle, so tests use an empty stub.
  resolve: { alias: { "@": p("./src"), "server-only": p("./tests/stubs/server-only.ts") } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
