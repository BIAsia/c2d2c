import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const html = await readFile(resolve(root, "index.html"), "utf8");
const css = await readFile(resolve(root, "styles.css"), "utf8");

const failures = [];

for (const required of [
  "site-header",
  "site-footer",
  "grid-template-columns: repeat(12",
  "@container stage (max-width: 720px)",
  "@container stage (max-width: 460px)",
  "prefers-reduced-motion: reduce",
]) {
  if (!`${html}\n${css}`.includes(required)) {
    failures.push(`Missing required contract: ${required}`);
  }
}

const localSources = [...html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)]
  .map((match) => match[1])
  .filter((path) => !["/styles.css", "/site.js"].includes(path));

for (const localSource of localSources) {
  try {
    await access(resolve(root, localSource.slice(1)));
  } catch {
    failures.push(`Missing local asset: ${localSource}`);
  }
}

if (/background:\s*oklch\([^)]*\.(?:0[3-9]|[1-9]\d)/.test(css)) {
  failures.push("A structural background may exceed the neutral chroma limit.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Static contract check passed: ${localSources.length} local media references verified.`,
  );
}
