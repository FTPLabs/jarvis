import * as esbuild from "esbuild";

  await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: "dist/index.js",
    sourcemap: true,
    external: [
      "pg-native",
      "better-sqlite3",
      "oracledb",
      "mysql",
      "mysql2",
      "tedious",
      "sqlite3",
    ],
  });

  console.log("\u2713 api-server built to dist/index.js");
  