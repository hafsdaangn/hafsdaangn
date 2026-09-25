import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { files: ["components/**/*.tsx"], rules: {
    // Authenticated no-store media must not pass through Next's public image cache.
    "@next/next/no-img-element": "off",
    // A full document navigation after logout discards in-memory private chat data.
    "@next/next/no-location-assign-relative-destination": "off",
  } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
