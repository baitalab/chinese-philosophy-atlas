import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function parseCsv(file) {
  const input = fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "").trim();
  const lines = input.split(/\r?\n/);
  const header = parseLine(lines.shift());
  return lines.filter(Boolean).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""]));
  });
}

function parseLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function pairKey(source, target, polarity, subtype) {
  const endpoints = [source, target].sort();
  return `${endpoints[0]}|${endpoints[1]}|${polarity}|${subtype}`;
}

function compact(text, limit = 58) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
}

const people = parseCsv("data/people.csv");
const names = new Map(parseCsv("data/people_i18n.csv").map((row) => [row.id, row]));
const taxonomies = new Map(
  parseCsv("data/taxonomies.csv")
    .filter((row) => row.kind === "domain")
    .map((row) => [row.id, row]),
);
const claims = parseCsv("data/research/claims.csv").filter((claim) => claim.publish_status === "published");
const claimTexts = parseCsv("data/research/claim_texts.csv");
const claimSources = parseCsv("data/research/claim_sources.csv");
const excerpts = new Map(parseCsv("data/research/source_excerpts.csv").map((row) => [row.excerpt_id, row]));
const relations = parseCsv("data/research/relations.csv");
const centralSources = new Set(parseCsv("data/sources.csv").map((row) => row.id));

const peopleById = new Map(people.map((person) => [person.id, person]));
const claimsById = new Map(claims.map((claim) => [claim.claim_id, claim]));
const personByClaim = new Map(claims.map((claim) => [claim.claim_id, claim.person_id]));
const textByClaimLocale = new Map(claimTexts.map((row) => [`${row.claim_id}|${row.locale}`, row.text]));
const evidenceByClaim = new Map();

for (const evidence of claimSources) {
  if (evidenceByClaim.has(evidence.claim_id)) continue;
  const excerpt = excerpts.get(evidence.excerpt_id);
  if (!evidence.source_id || !centralSources.has(evidence.source_id) || !evidence.locator || !excerpt?.excerpt_text) continue;
  evidenceByClaim.set(evidence.claim_id, {
    source_id: evidence.source_id,
    locator: evidence.locator,
    excerpt_text: excerpt.excerpt_text,
    evidence_status: evidence.evidence_status || excerpt.extraction_status || "locator-reviewed",
  });
}

const degree = new Map(people.map((person) => [person.id, 0]));
const existing = new Set();
for (const relation of relations) {
  const sourcePerson = personByClaim.get(relation.source_claim_id);
  const targetPerson = personByClaim.get(relation.target_claim_id);
  if (sourcePerson && degree.has(sourcePerson)) degree.set(sourcePerson, degree.get(sourcePerson) + 1);
  if (targetPerson && degree.has(targetPerson)) degree.set(targetPerson, degree.get(targetPerson) + 1);
  existing.add(pairKey(relation.source_claim_id, relation.target_claim_id, relation.polarity, relation.subtype));
}

const periodOrder = new Map([
  ["ancient-preqin", 0],
  ["qin-han", 1],
  ["wei-jin-sui-tang", 2],
  ["song-yuan-ming", 3],
  ["late-qing-republic", 4],
  ["contemporary-china", 5],
]);

const eligibleClaims = claims.filter((claim) => {
  const person = peopleById.get(claim.person_id);
  return person && person.historicity !== "legendary" && evidenceByClaim.has(claim.claim_id) && claim.domain_ids;
});

const candidates = [];
for (let leftIndex = 0; leftIndex < eligibleClaims.length; leftIndex += 1) {
  const left = eligibleClaims[leftIndex];
  const leftPerson = peopleById.get(left.person_id);
  const leftDomains = new Set(left.domain_ids.split(";").filter(Boolean));
  for (let rightIndex = leftIndex + 1; rightIndex < eligibleClaims.length; rightIndex += 1) {
    const right = eligibleClaims[rightIndex];
    if (left.person_id === right.person_id) continue;
    const rightPerson = peopleById.get(right.person_id);
    const shared = right.domain_ids.split(";").filter((domain) => leftDomains.has(domain));
    if (shared.length === 0) continue;
    const key = pairKey(left.claim_id, right.claim_id, "positive", "similarity");
    if (existing.has(key)) continue;
    const leftPeriod = periodOrder.get(leftPerson.period) ?? 0;
    const rightPeriod = periodOrder.get(rightPerson.period) ?? 0;
    const periodDistance = Math.abs(leftPeriod - rightPeriod);
    const crossPeriod = leftPerson.period !== rightPerson.period;
    const lowDegree = Math.min(degree.get(left.person_id), degree.get(right.person_id));
    const degreeSum = degree.get(left.person_id) + degree.get(right.person_id);
    candidates.push({
      left,
      right,
      shared,
      key,
      crossPeriod,
      periodDistance,
      score: lowDegree * 1000 + degreeSum * 80 - (crossPeriod ? 55 : 0) - Math.min(periodDistance, 3) * 8 - shared.length * 3,
    });
  }
}

candidates.sort((a, b) => a.score - b.score || a.key.localeCompare(b.key));

const selected = [];
const addedDegree = new Map(people.map((person) => [person.id, 0]));
const used = new Set(existing);

function selectWithCap(cap, target) {
  for (const candidate of candidates) {
    if (selected.length >= target) return;
    if (used.has(candidate.key)) continue;
    const leftAdded = addedDegree.get(candidate.left.person_id);
    const rightAdded = addedDegree.get(candidate.right.person_id);
    if (leftAdded >= cap || rightAdded >= cap) continue;
    selected.push(candidate);
    used.add(candidate.key);
    addedDegree.set(candidate.left.person_id, leftAdded + 1);
    addedDegree.set(candidate.right.person_id, rightAdded + 1);
  }
}

selectWithCap(1, 60);
selectWithCap(2, 60);
selectWithCap(3, 60);

if (selected.length < 60) {
  throw new Error(`Only ${selected.length} non-duplicate, evidenced similarity relations could be selected.`);
}

const batchRelations = selected.slice(0, 60).map((candidate) => {
  const { left, right, shared } = candidate;
  const leftName = names.get(left.person_id) ?? { name_zh: left.person_id, name_en: left.person_id };
  const rightName = names.get(right.person_id) ?? { name_zh: right.person_id, name_en: right.person_id };
  const domainZh = shared.map((id) => taxonomies.get(id)?.label_zh ?? id).join("、");
  const domainEn = shared.map((id) => taxonomies.get(id)?.label_en ?? id).join(", ");
  const leftZh = textByClaimLocale.get(`${left.claim_id}|zh-CN`) ?? textByClaimLocale.get(`${left.claim_id}|zh`) ?? left.claim_id;
  const rightZh = textByClaimLocale.get(`${right.claim_id}|zh-CN`) ?? textByClaimLocale.get(`${right.claim_id}|zh`) ?? right.claim_id;
  const leftEn = textByClaimLocale.get(`${left.claim_id}|en`) ?? left.claim_id;
  const rightEn = textByClaimLocale.get(`${right.claim_id}|en`) ?? right.claim_id;
  const evidence = evidenceByClaim.get(right.claim_id);
  const idSeed = [left.claim_id, right.claim_id].sort().join("|");
  return {
    relation_id: `density-c-${crypto.createHash("sha1").update(idSeed).digest("hex").slice(0, 14)}`,
    source_claim_id: left.claim_id,
    target_claim_id: right.claim_id,
    polarity: "positive",
    subtype: "similarity",
    basis: "editorial",
    direction: "undirected",
    historical_influence: "conceptual-only",
    note_zh: `${leftName.name_zh}与${rightName.name_zh}的两条已取证观点都涉及“${domainZh}”：前者强调“${compact(leftZh)}”，后者强调“${compact(rightZh)}”。此线只表示${candidate.crossPeriod ? "跨时期" : "同一时期"}主题相似，不主张历史影响。`,
    note_en: `The evidenced claims by ${leftName.name_en} and ${rightName.name_en} both address ${domainEn}: the former emphasizes “${compact(leftEn)}”, the latter “${compact(rightEn)}”. This marks ${candidate.crossPeriod ? "cross-period" : "same-period"} conceptual similarity only, not historical influence.`,
    source_id: evidence.source_id,
    locator: evidence.locator,
    excerpt_text: evidence.excerpt_text,
    evidence_role: "conceptual-comparison",
    evidence_status: evidence.evidence_status,
  };
});

const batch = {
  batch_id: "density-low-degree-2026-07-17",
  reviewer: "density-low-degree-agent-2026-07-17",
  sources: [],
  claims: [],
  relations: batchRelations,
};

const output = path.join(root, "data/research/imports/density-low-degree-2026-07-17.json");
fs.writeFileSync(output, `${JSON.stringify(batch, null, 2)}\n`, "utf8");

// Treat the generated file as an import artifact, not merely generator output:
// re-read it and verify every endpoint and evidence tuple against the current
// central research tables before reporting success.
const written = JSON.parse(fs.readFileSync(output, "utf8"));
const relationIds = new Set();
const writtenSignatures = new Set();
const centralEvidence = new Set();
for (const link of claimSources) {
  const excerpt = excerpts.get(link.excerpt_id);
  if (!excerpt?.excerpt_text) continue;
  centralEvidence.add(JSON.stringify([link.source_id, link.locator, excerpt.excerpt_text]));
}
for (const relation of written.relations) {
  if (relationIds.has(relation.relation_id)) throw new Error(`Duplicate relation ID: ${relation.relation_id}`);
  relationIds.add(relation.relation_id);
  if (!claimsById.has(relation.source_claim_id) || !claimsById.has(relation.target_claim_id)) {
    throw new Error(`Unknown relation endpoint: ${relation.relation_id}`);
  }
  if (!centralSources.has(relation.source_id)) throw new Error(`Unknown central source: ${relation.relation_id}`);
  if (!relation.locator || !relation.excerpt_text) throw new Error(`Missing located excerpt: ${relation.relation_id}`);
  if (!centralEvidence.has(JSON.stringify([relation.source_id, relation.locator, relation.excerpt_text]))) {
    throw new Error(`Evidence is not an exact central-table tuple: ${relation.relation_id}`);
  }
  if (relation.historical_influence !== "conceptual-only") throw new Error(`Similarity overstated as influence: ${relation.relation_id}`);
  const signature = pairKey(relation.source_claim_id, relation.target_claim_id, relation.polarity, relation.subtype);
  if (existing.has(signature) || writtenSignatures.has(signature)) throw new Error(`Duplicate edge signature: ${relation.relation_id}`);
  writtenSignatures.add(signature);
}
if (written.relations.length < 60) throw new Error(`Expected at least 60 relations, got ${written.relations.length}`);

const coveredPeople = new Set(batchRelations.flatMap((relation) => [
  personByClaim.get(relation.source_claim_id),
  personByClaim.get(relation.target_claim_id),
]));
console.log(JSON.stringify({
  output,
  relations: batchRelations.length,
  peopleCovered: coveredPeople.size,
  crossPeriod: selected.slice(0, 60).filter((candidate) => candidate.crossPeriod).length,
  startingDegreeRange: [
    Math.min(...[...coveredPeople].map((personId) => degree.get(personId))),
    Math.max(...[...coveredPeople].map((personId) => degree.get(personId))),
  ],
  validation: {
    json: "passed",
    uniqueIds: "passed",
    endpoints: "passed",
    centralEvidenceTuples: "passed",
    duplicateSignatures: "passed",
    influenceSemantics: "passed",
  },
}, null, 2));
