import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "model",
          include: ["tests/model/**/*.test.{ts,tsx}"],
        },
      },
      {
        // Needs the Firebase emulators: run with `npm run test:emulator`.
        extends: true,
        test: {
          name: "emulator",
          include: ["tests/data/**/*.test.ts", "tests/rules/**/*.test.ts"],
          globalSetup: ["tests/data/global-setup.ts"],
          // The tests share one emulator database, so files run one at a time.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
