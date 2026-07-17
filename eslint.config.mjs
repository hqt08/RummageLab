import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import { globalIgnores } from "eslint/config";

const baseDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

const eslintConfig = [
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"],
  }),
  globalIgnores([
    ".next/**",
    "out/**",
    "coverage/**",
    "node_modules/**",
    "next-env.d.ts",
  ]),
];

export default eslintConfig;
