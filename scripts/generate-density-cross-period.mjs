import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const research = path.join(root, "data", "research");
const output = path.join(research, "imports", "density-cross-period-2026-07-17.json");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift();
  return rows.filter((values) => values.some(Boolean)).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function readCsv(file) {
  return parseCsv(fs.readFileSync(path.join(root, file), "utf8"));
}

const claims = readCsv("data/research/claims.csv");
const people = readCsv("data/people.csv");
const claimSources = readCsv("data/research/claim_sources.csv");
const excerpts = readCsv("data/research/source_excerpts.csv");
const relations = readCsv("data/research/relations.csv");

const periodByPerson = new Map(people.map((person) => [person.id, person.period]));
const excerptById = new Map(excerpts.map((excerpt) => [excerpt.excerpt_id, excerpt]));
const evidenceByClaim = new Map();
for (const evidence of claimSources) {
  const excerpt = excerptById.get(evidence.excerpt_id);
  if (
    !evidenceByClaim.has(evidence.claim_id) &&
    evidence.source_id &&
    evidence.locator &&
    excerpt?.excerpt_text &&
    (evidence.evidence_status === "locator-reviewed" || excerpt.extraction_status === "locator-reviewed")
  ) {
    evidenceByClaim.set(evidence.claim_id, {
      source_id: evidence.source_id,
      locator: excerpt.locator,
      excerpt_text: excerpt.excerpt_text,
    });
  }
}

const eligible = claims
  .filter((claim) => claim.publish_status === "published" && evidenceByClaim.has(claim.claim_id))
  .map((claim) => ({
    ...claim,
    period: periodByPerson.get(claim.person_id),
    domains: claim.domain_ids.split(";").filter(Boolean),
  }))
  .filter((claim) => claim.period && claim.domains.length);

const existingKeys = new Set(
  relations.map((relation) => {
    const pair = [relation.source_claim_id, relation.target_claim_id].sort().join("|");
    return `${pair}|${relation.polarity}|${relation.subtype}`;
  }),
);

const periodOrder = new Map([
  ["ancient-preqin", 0],
  ["qin-han", 1],
  ["wei-jin-tang", 2],
  ["song-yuan-ming-qing", 3],
  ["late-qing-republic", 4],
  ["contemporary-china", 5],
]);

const buckets = [
  { id: "ancient-hantang", from: ["ancient-preqin"], to: ["qin-han", "wei-jin-tang"], count: 18 },
  { id: "hantang-songqing", from: ["qin-han", "wei-jin-tang"], to: ["song-yuan-ming-qing"], count: 18 },
  { id: "songqing-modern", from: ["song-yuan-ming-qing"], to: ["late-qing-republic", "contemporary-china"], count: 18 },
  { id: "modern-internal", from: ["late-qing-republic"], to: ["contemporary-china"], count: 18 },
];

const domainLabels = {
  "tiandao-metaphysics": "天道与形上",
  "mind-human-nature": "心性与人性",
  "knowledge-method": "知识与方法",
  "names-language": "名辩与语言",
  "ethics-cultivation": "伦理与修养",
  "politics-governance": "政治与治理",
  "ritual-law": "礼法与制度",
  "religion-transcendence": "宗教与超越",
  "nature-technology": "自然与技艺",
  "history-culture": "历史与文化",
  "education-hermeneutics": "教育与诠释",
  "aesthetics-art": "艺术与审美",
  "society-world": "社会与天下",
};

const usage = new Map();
const selectedKeys = new Set(existingKeys);
const generated = [];

function overlap(left, right) {
  return left.domains.filter((domain) => right.domains.includes(domain));
}

for (const bucket of buckets) {
  const left = eligible.filter((claim) => bucket.from.includes(claim.period));
  const right = eligible.filter((claim) => bucket.to.includes(claim.period));
  const candidates = [];
  for (const source of left) {
    for (const target of right) {
      if (source.person_id === target.person_id) continue;
      const shared = overlap(source, target);
      if (!shared.length) continue;
      const pair = [source.claim_id, target.claim_id].sort().join("|");
      const key = `${pair}|positive|domain-overlap`;
      if (selectedKeys.has(key)) continue;
      candidates.push({
        source,
        target,
        shared,
        key,
        score:
          shared.length * 100 -
          (usage.get(source.claim_id) ?? 0) * 15 -
          (usage.get(target.claim_id) ?? 0) * 15 -
          Math.abs(Number(source.active_year) - Number(target.active_year)) / 10000,
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.source.claim_id.localeCompare(b.source.claim_id) || a.target.claim_id.localeCompare(b.target.claim_id));
  let count = 0;
  for (const candidate of candidates) {
    if (count >= bucket.count) break;
    if ((usage.get(candidate.source.claim_id) ?? 0) >= 3 || (usage.get(candidate.target.claim_id) ?? 0) >= 3) continue;
    const evidence = evidenceByClaim.get(candidate.target.claim_id);
    const labels = candidate.shared.map((domain) => domainLabels[domain] ?? domain);
    const relationId = `density-xp-${bucket.id}-${String(count + 1).padStart(2, "0")}-${candidate.source.claim_id}-${candidate.target.claim_id}`;
    generated.push({
      relation_id: relationId,
      source_claim_id: candidate.source.claim_id,
      target_claim_id: candidate.target.claim_id,
      polarity: "positive",
      subtype: "domain-overlap",
      basis: "taxonomy-overlap-and-located-claim-evidence",
      direction: "undirected",
      historical_influence: "conceptual-only",
      note_zh: `两项跨时期命题共同归入“${labels.join("、")}”领域；本关系只表示项目分类体系中的分析性相似，不表示历史影响或师承。`,
      note_en: `These cross-period claims share the project domains ${candidate.shared.join(", ")}. The link records analytical similarity only, not historical influence or transmission.`,
      source_id: evidence.source_id,
      locator: evidence.locator,
      excerpt_text: evidence.excerpt_text,
      evidence_role: "located-target-claim-support",
      evidence_status: "locator-reviewed",
    });
    selectedKeys.add(candidate.key);
    usage.set(candidate.source.claim_id, (usage.get(candidate.source.claim_id) ?? 0) + 1);
    usage.set(candidate.target.claim_id, (usage.get(candidate.target.claim_id) ?? 0) + 1);
    count += 1;
  }
  if (count < bucket.count) throw new Error(`Only generated ${count}/${bucket.count} relations for ${bucket.id}`);
}

for (const relation of generated) {
  const sourcePeriod = eligible.find((claim) => claim.claim_id === relation.source_claim_id)?.period;
  const targetPeriod = eligible.find((claim) => claim.claim_id === relation.target_claim_id)?.period;
  if ((periodOrder.get(sourcePeriod) ?? -1) >= (periodOrder.get(targetPeriod) ?? -1)) {
    throw new Error(`Non-forward period relation ${relation.relation_id}`);
  }
}

fs.writeFileSync(
  output,
  `${JSON.stringify({
    batch_id: "density-cross-period-2026-07-17",
    reviewer: "codex-cross-period-density-2026-07-17",
    sources: [],
    claims: [],
    relations: generated,
  }, null, 2)}\n`,
  "utf8",
);

console.log(`Generated ${generated.length} cross-period relations at ${path.relative(root, output)}`);
for (const bucket of buckets) {
  console.log(`${bucket.id}: ${generated.filter((relation) => relation.relation_id.startsWith(`density-xp-${bucket.id}-`)).length}`);
}
