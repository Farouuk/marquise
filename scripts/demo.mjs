import { spawnSync } from "node:child_process";
import { projectRoot } from "./sites-env.mjs";

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: projectRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(["scripts/run-framework.mjs", "build"]);
run(["scripts/migrate-local.mjs"]);
console.log("Marquise demo: http://localhost:5173 — fictional data, paid AI disabled.");
run([
  "--import", "./scripts/sites-env.mjs", "./node_modules/wrangler/bin/wrangler.js",
  "dev", "--config", "dist/server/wrangler.json", "--local",
  "--persist-to", ".wrangler/state", "--ip", "127.0.0.1", "--port", "5173",
  "--inspector-port", "0", "--var", "AI_ENABLED:false", "--var", "OWNER_EMAIL:",
  "--var", "OPENAI_API_KEY:",
]);
