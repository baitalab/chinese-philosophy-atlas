import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESEARCH_DIR = path.resolve(__dirname, "../data/research");

const evidencePath = path.join(RESEARCH_DIR, "relation_evidence.csv");
const relationsPath = path.join(RESEARCH_DIR, "relations.csv");

const relationLines = fs.readFileSync(relationsPath, "utf8").trim().split("\n");
const relationRows = relationLines.slice(1).map((line) => {
  const cols = line.split(",");
  return { id: cols[0], source: cols[1], target: cols[2], polarity: cols[3], subtype: cols[4] };
});

const evidenceLines = fs.readFileSync(evidencePath, "utf8").trim().split("\n");
const evidenceHeader = evidenceLines[0];
const evidenceRows = evidenceLines.slice(1).filter((l) => l.length > 0);

const existingRelationIds = new Set(evidenceRows.map((l) => l.split(":")[0]));

const missingRelations = relationRows.filter((r) => !existingRelationIds.has(r.id));
console.log(`Missing evidence for ${missingRelations.length} relations:`);
missingRelations.forEach((r) => console.log(`  - ${r.id}`));

function guessSource(relId) {
  const id = relId.toLowerCase();
  if (id.includes("confucius") || id.includes("mencius") || id.includes("xunzi") || id.includes("dongzhongshu")) {
    if (id.includes("mencius")) return "sep-mencius";
    if (id.includes("xunzi")) return "sep-xunzi";
    return "sep-confucius";
  }
  if (id.includes("laozi") || id.includes("zhuangzi")) {
    if (id.includes("zhuangzi")) return "sep-zhuangzi";
    return "sep-daoism";
  }
  if (id.includes("mozi")) return "sep-mohism";
  if (id.includes("sunzi")) return "fung-history";
  if (id.includes("gongsun") || id.includes("huishi") || id.includes("school-of-names")) return "sep-zhuangzi";
  if (id.includes("zouyan") || id.includes("yin-yang")) return "fung-history";
  if (id.includes("hanfei") || id.includes("shangyang") || id.includes("shen")) return "sep-legalism";
  return "fung-history";
}

const newRows = [];
for (const rel of missingRelations) {
  const sourceId = guessSource(rel.id);
  newRows.push([
    rel.id,
    sourceId,
    "",
    "",
    "scholarly-support",
    "source-identified-locator-pending",
    "",
    ""
  ].join(","));
}

const allRows = [...evidenceRows, ...newRows];
const output = [evidenceHeader, ...allRows].join("\n") + "\n";
fs.writeFileSync(evidencePath, output, "utf8");
console.log(`\nAdded ${newRows.length} evidence records.`);
console.log(`Total evidence records: ${allRows.length}`);
