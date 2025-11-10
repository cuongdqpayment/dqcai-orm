// rollup.config.js
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import esbuild from "rollup-plugin-esbuild";

// ✅ QUAN TRỌNG: Phải mark database drivers là external
// Vì chúng là peerDependencies (optional)
const external = [
  "pg",
  "mysql2",
  "mariadb",
  "mongodb",
  "better-sqlite3",
  "oracledb",
  "mssql",
  "@dqcai/logger",
];

const plugins = [
  json(),
  nodeResolve({
    preferBuiltins: true, // ✅ Ưu tiên Node.js built-in modules
  }),
  commonjs(),
  typescript({
    tsconfig: "./tsconfig.json",
    declaration: true,
    declarationDir: "lib",
    declarationMap: true,
    rootDir: "src",
    noEmitHelpers: true,
    importHelpers: false,
    target: "es2020",
  }),
  esbuild({
    minify: true,
    target: "es2020",
    charset: "utf8",
    legalComments: "none",
  }),
];

export default // ==========================================
// 1. MAIN BUNDLE - Core + Adapters + Types
// ==========================================
{
  input: "src/index.ts",
  output: [
    // CJS - Cho Node.js cũ và require()
    {
      file: "lib/index.js",
      format: "cjs",
      inlineDynamicImports: true, //  Inline dynamic imports (nếu muốn giữ 1 file)
      sourcemap: false,
      exports: "named", // ✅ Dùng "named" thay vì "auto" cho rõ ràng
    },
    // ESM - Cho modern Node.js và bundlers (tree-shaking)
    {
      file: "lib/index.mjs",
      format: "esm",
      inlineDynamicImports: true, //  Inline dynamic imports (nếu muốn giữ 1 file)
      sourcemap: false,
    },
    // UMD - Chỉ nếu cần browser/CDN support
    // ⚠️ Nếu thư viện chỉ dùng cho backend Node.js thì XÓA phần này
    /* {
      file: "lib/index.umd.js",
      format: "umd",
      inlineDynamicImports: true, //  Inline dynamic imports (nếu muốn giữ 1 file)
      name: "DQCAIORM", // ✅ Không dùng @ trong UMD name
      sourcemap: true,
    }, */
  ],
  plugins,
  external,
};
