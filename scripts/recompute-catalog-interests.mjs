import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inferInterestsFromCatalogEntry } from "./lib/inferInterests.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let catalogPath = "data/catalog.json";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--catalog" && args[i + 1]) {
      catalogPath = args[i + 1];
      i += 1;
    }
  }
  return { catalogPath };
}

async function main() {
  const { catalogPath } = parseArgs();
  const abs = path.isAbsolute(catalogPath) ? catalogPath : path.join(repoRoot, catalogPath);
  const raw = await fs.readFile(abs, "utf8");
  /** @type {Array<Record<string, unknown>>} */
  const catalog = JSON.parse(raw);
  if (!Array.isArray(catalog)) {
    throw new Error(`Expected array in ${abs}`);
  }

  const next = catalog.map((row) => {
    const subject = String(row.subject || "");
    const title = String(row.title || "");
    const description = String(row.description || "");
    return {
      ...row,
      interests: inferInterestsFromCatalogEntry({ subject, title, description })
    };
  });

  await fs.writeFile(abs, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`Updated interests for ${next.length} catalog rows → ${abs}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
