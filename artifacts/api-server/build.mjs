import * as esbuild from "esbuild";
  import { pino } from "esbuild-plugin-pino";

  await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: "dist/index.mjs",
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
    plugins: [pino({ transports: ["pino-pretty"] })],
  });

  console.log("✓ api-server built to dist/index.mjs");
  