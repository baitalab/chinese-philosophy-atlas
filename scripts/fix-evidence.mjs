import fs from "node:fs";
import path from "node:path";

const RESEARCH_DIR = path.resolve("data/research");
const relEvidenceFile = path.join(RESEARCH_DIR, "relation_evidence.csv");

let content = fs.readFileSync(relEvidenceFile, "utf8");
let lines = content.trim().split("\n");

const header = lines[0];
const validLines = [header];
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(",");
  if (cols.length === 8) {
    validLines.push(lines[i]);
  }
}

fs.writeFileSync(relEvidenceFile, validLines.join("\n") + "\n", "utf8");
console.log(`Cleaned relation_evidence.csv: ${validLines.length - 1} valid evidence entries`);
