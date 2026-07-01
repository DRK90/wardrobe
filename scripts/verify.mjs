import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const required = [
  "index.html",
  "src/main.jsx",
  "src/App.jsx",
  "src/styles.css",
  "public/manifest.webmanifest",
  "public/sw.js",
  "README.md",
  "AGENTS.md",
  "PRODUCT.md",
  "DESIGN.md",
  "docs/architecture-decision-guide.md",
  "docs/logical-data-model.md"
];

for (const file of required) {
  await stat(file);
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === ".claude" ||
      entry.name === ".cursor" ||
      entry.name === ".codex" ||
      entry.name === ".agents"
    ) {
      continue;
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

const textExtensions = new Set([".html", ".css", ".js", ".jsx", ".json", ".md", ".webmanifest", ".svg"]);
const files = await walk(".");
for (const file of files) {
  if (![...textExtensions].some((ext) => file.endsWith(ext))) continue;
  const text = await readFile(file, "utf8");
  const lines = text.split("\n");
  const trailing = lines.findIndex((line) => /[ \t]+$/.test(line));
  if (trailing !== -1) {
    throw new Error(`${file}:${trailing + 1} has trailing whitespace`);
  }
}

console.log("wardrobe verify passed");
