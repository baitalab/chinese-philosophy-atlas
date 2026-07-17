import fs from "node:fs";
import path from "node:path";

const RESEARCH_DIR = path.resolve("data/research");
const relEvidenceFile = path.join(RESEARCH_DIR, "relation_evidence.csv");

function csvEscape(value) {
  if (typeof value !== "string") return String(value);
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// First, clean up the evidence file - remove bad rows
let content = fs.readFileSync(relEvidenceFile, "utf8");
let lines = content.trim().split("\n");
const header = lines[0];
const validLines = [header];
const existingEvidenceKeys = new Set();

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(",");
  if (cols.length === 8 && cols[0] && cols[1]) {
    validLines.push(lines[i]);
    existingEvidenceKeys.add(`${cols[0]}|${cols[1]}`);
  }
}

// Now collect all new relations and their sources
const newRelations = [
  ["rel-confucius-ren-rectification", ["sep-confucius", "fung-history"]],
  ["rel-confucius-junzi-ren", ["sep-confucius", "chan-sourcebook"]],
  ["rel-confucius-harmony-junzi", ["sep-confucius"]],
  ["rel-confucius-virtue-rectification", ["sep-confucius", "chan-sourcebook"]],
  ["rel-confucius-reciprocity-ren", ["sep-confucius", "fung-history"]],
  ["rel-laozi-wuwei-naturalness", ["sep-daoism", "chan-sourcebook"]],
  ["rel-laozi-reversal-softness", ["sep-daoism", "fung-history"]],
  ["rel-laozi-contentment-softness", ["sep-daoism"]],
  ["rel-laozi-dao-wuwei", ["sep-daoism", "chan-sourcebook"]],
  ["rel-laozi-reversal-natural", ["fung-history"]],
  ["rel-zhuangzi-perspectives-wandering", ["sep-zhuangzi", "chan-sourcebook"]],
  ["rel-zhuangzi-oneness-perspectives", ["sep-zhuangzi", "fung-history"]],
  ["rel-zhuangzi-skill-self", ["sep-zhuangzi"]],
  ["rel-zhuangzi-life-death-oneness", ["sep-zhuangzi", "chan-sourcebook"]],
  ["rel-zhuangzi-wandering-self", ["sep-zhuangzi", "fung-history"]],
  ["rel-mencius-sprouts-good", ["sep-mencius", "chan-sourcebook"]],
  ["rel-mencius-people-virtue", ["sep-mencius", "fung-history"]],
  ["rel-mencius-qi-sprouts", ["sep-mencius"]],
  ["rel-mencius-rightness-kingly", ["sep-mencius", "chan-sourcebook"]],
  ["rel-mencius-good-kingly", ["sep-mencius", "fung-history"]],
  ["rel-xunzi-nature-ritual", ["sep-xunzi", "chan-sourcebook"]],
  ["rel-xunzi-learning-nature", ["sep-xunzi", "fung-history"]],
  ["rel-xunzi-heaven-ritual", ["sep-xunzi", "chan-sourcebook"]],
  ["rel-xunzi-rectification-order", ["sep-xunzi", "fung-history"]],
  ["rel-xunzi-yi-li-learning", ["sep-xunzi"]],
  ["rel-mozi-care-order", ["sep-mohist"]],
  ["rel-mozi-offensive-care", ["sep-mohist", "chan-sourcebook"]],
  ["rel-mozi-heaven-will-care", ["sep-mohist", "fung-history"]],
  ["rel-mozi-frugality-care", ["sep-mohist"]],
  ["rel-mozi-merit-care", ["sep-mohist", "chan-sourcebook"]],
  ["rel-confucius-laozi-ritual-wuwei", ["sep-confucius", "sep-daoism", "fung-history"]],
  ["rel-mencius-zhuangzi-nature", ["sep-mencius", "sep-zhuangzi", "fung-history"]],
  ["rel-mencius-mozi-yi-care", ["sep-mencius", "sep-mohist", "fung-history"]],
  ["rel-xunzi-mozi-ritual-frugality", ["sep-xunzi", "sep-mohist"]],
  ["rel-laozi-shangyang-wuwei-law", ["sep-daoism", "sep-legalism", "fung-history"]],
  ["rel-zhuangzi-shen-dao-technical", ["sep-zhuangzi", "sep-legalism"]],
  ["rel-huishi-zhuangzi-oneness", ["sep-zhuangzi", "sep-school-of-names", "fung-history"]],
  ["rel-xunzi-hanfei-nature-law", ["sep-xunzi", "sep-legalism", "fung-history"]],
  ["rel-xunzi-hanfei-rectification", ["sep-xunzi", "sep-legalism", "fung-history"]],
  ["rel-dongzhongshu-xunzi-heaven", ["sep-xunzi", "sep-dong-zhongshu", "fung-history"]],
  ["rel-zouyan-confucius-order", ["sep-yin-yang", "fung-history"]],
];

let added = 0;
for (const [relId, sources] of newRelations) {
  for (const sourceId of sources) {
    const key = `${relId}|${sourceId}`;
    if (existingEvidenceKeys.has(key)) continue;
    
    const row = [relId, sourceId, "", "", "scholarly-support", "source-identified-locator-pending", "", ""];
    validLines.push(row.map(csvEscape).join(","));
    existingEvidenceKeys.add(key);
    added++;
  }
}

fs.writeFileSync(relEvidenceFile, validLines.join("\n") + "\n", "utf8");
console.log(`Cleaned evidence file, added ${added} new evidence entries`);
