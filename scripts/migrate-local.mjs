import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./sites-env.mjs";

const built = JSON.parse(readFileSync(new URL("../dist/server/wrangler.json", import.meta.url), "utf8"));
const configPath = path.join(projectRoot, ".sites-runtime", "migrations.json");
writeFileSync(configPath, JSON.stringify({
  name: "marquise-local-migrations",
  d1_databases: built.d1_databases.map((database) => ({
    ...database, migrations_dir: path.join(projectRoot, "drizzle"),
  })),
}));
const result = spawnSync(process.execPath, [
    "--import", "./scripts/sites-env.mjs", "./node_modules/wrangler/bin/wrangler.js",
    "d1", "migrations", "apply", "DB", "--local", "--config", configPath,
    "--persist-to", ".wrangler/state",
  ], { cwd: projectRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
