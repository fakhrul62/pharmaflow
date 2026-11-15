import { existsSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status || 1);
};
if (!existsSync("apps/api/.env"))
  copyFileSync("apps/api/.env.example", "apps/api/.env");
run("docker", ["compose", "up", "-d", "--wait"]);
run("npm", ["run", "db:generate"]);
run("npm", ["run", "db:migrate"]);
run("npm", ["run", "db:seed"]);
console.log(
  "\nPharmaFlow is ready. Run npm run dev and open http://localhost:5173\nLocal demo: admin@pharmaflow.local / PharmaFlow!2026",
);
