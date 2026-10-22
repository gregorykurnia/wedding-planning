import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The new UI only renders: its data comes from `src/lib/data/` (plan §2.7, Phase 8 review S3).
const veilLayering = {
  patterns: [
    { group: ["firebase", "firebase/*"], message: "src/veil gets data from src/lib/data/, not Firebase." },
    {
      group: ["@/lib/firebase", "@/lib/collections/*", "@/lib/auth-context", "@/lib/use-collection", "**/lib/firebase", "**/lib/collections/*"],
      message: "src/veil gets data from src/lib/data/; this plumbing is for the data layer.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/veil/**/*.{ts,tsx}"],
    // The dev-only gallery (NEXT_PUBLIC_VEIL_GALLERY=1) reads the emulator's files directly to show the
    // upload pipeline at work; it never ships to the couple, so it is the one written exception.
    ignores: ["src/veil/gallery/**"],
    rules: { "no-restricted-imports": ["error", veilLayering] },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    ".next-demo/**",
    "test-results/**",
    "playwright-report/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
