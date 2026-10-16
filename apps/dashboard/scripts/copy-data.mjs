// Copies the scraper output (repo-root /data) into public/data so Vite serves
// it in dev and bundles it in the build. public/data is git-ignored.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../../data");
const dest = resolve(here, "../public/data");

mkdirSync(dest, { recursive: true });
for (const file of ["competitions.json", "competitions.csv"]) {
  const from = resolve(src, file);
  if (existsSync(from)) {
    cpSync(from, resolve(dest, file));
    console.log(`copied ${file}`);
  } else {
    console.warn(`warning: ${from} not found — run "python -m scraper" first`);
  }
}

