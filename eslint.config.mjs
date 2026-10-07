import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Gitignored working dirs. ESLint's flat config does not read .gitignore,
    // so `npm run lint` used to crawl thousands of files here (a local Chrome
    // profile and an archived design's node_modules) instead of finishing.
    ".tmp/**",
    "design/unwanted-designs/**",
    // Vendored agent skills (third-party code, not part of the app).
    ".agents/skills/**",
    ".claude/**",
  ]),
  {
    // GoDaddy's Node.js hosting entry point is deliberately CommonJS: the host
    // runs `node server.js` from a package with no `type: module`.
    files: ["server.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
