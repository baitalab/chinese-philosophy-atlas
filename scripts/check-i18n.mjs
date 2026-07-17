import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));

const [english, chinese, scopes] = await Promise.all([
  load("src/i18n/messages/en.json"),
  load("src/i18n/messages/zh-CN.json"),
  load("src/i18n/scopes.json"),
]);

const localeKeys = {
  en: Object.keys(english).sort(),
  "zh-CN": Object.keys(chinese).sort(),
};
const canonical = new Set(localeKeys.en);
const assigned = Object.values(scopes).flat();
const assignedSet = new Set(assigned);
const failures = [];

for (const [locale, keys] of Object.entries(localeKeys)) {
  const set = new Set(keys);
  const missing = [...canonical].filter((key) => !set.has(key));
  const extra = keys.filter((key) => !canonical.has(key));
  if (missing.length) failures.push(`${locale} missing: ${missing.join(", ")}`);
  if (extra.length) failures.push(`${locale} extra: ${extra.join(", ")}`);
}

const unscoped = [...canonical].filter((key) => !assignedSet.has(key));
const unknown = [...assignedSet].filter((key) => !canonical.has(key));
const duplicates = assigned.filter((key, index) => assigned.indexOf(key) !== index);
if (unscoped.length) failures.push(`Unscoped keys: ${unscoped.join(", ")}`);
if (unknown.length) failures.push(`Unknown scoped keys: ${unknown.join(", ")}`);
if (duplicates.length) failures.push(`Keys assigned to multiple scopes: ${[...new Set(duplicates)].join(", ")}`);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`i18n OK: ${canonical.size} keys, ${Object.keys(scopes).length} audited UI scopes, ${Object.keys(localeKeys).length} locales.`);
