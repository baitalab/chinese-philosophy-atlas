import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

const root = process.cwd();
const dataDir = path.join(root, "data");
const researchDir = path.join(dataDir, "research");
const importDir = path.join(researchDir, "imports");
const today = new Date().toISOString().slice(0, 10);

async function csv(filePath) {
  return parse(await readFile(filePath, "utf8"), { columns: true, skip_empty_lines: true, trim: true, bom: true });
}

function cell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function writeCsv(filePath, columns, rows) {
  const body = [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))]
    .map((row) => row.map(cell).join(","))
    .join("\n");
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${body}\n`, "utf8");
  await rename(temporary, filePath);
}

function array(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value ?? "").split(";").map((item) => item.trim()).filter(Boolean);
}

const domainAliases = new Map(Object.entries({
  metaphysics: "tiandao-metaphysics", cosmology: "tiandao-metaphysics",
  mind: "mind-human-nature", consciousness: "mind-human-nature",
  epistemology: "knowledge-method", dialectics: "knowledge-method",
  logic: "names-language", language: "names-language",
  ethics: "ethics-cultivation", "self-cultivation": "ethics-cultivation", humanism: "ethics-cultivation",
  political: "politics-governance", administration: "politics-governance", strategy: "politics-governance",
  ritual: "ritual-law", law: "ritual-law",
  religion: "religion-transcendence",
  nature: "nature-technology", science: "nature-technology", technology: "nature-technology", ecology: "nature-technology",
  history: "history-culture", historiography: "history-culture", culture: "history-culture", modernity: "history-culture",
  education: "education-hermeneutics", hermeneutics: "education-hermeneutics",
  aesthetics: "aesthetics-art", music: "aesthetics-art",
  economics: "society-world", gender: "society-world", international: "society-world", utopianism: "society-world", "world-order": "society-world",
  society: "society-world", politics: "politics-governance", "human-nature": "mind-human-nature", freedom: "ethics-cultivation",
}));

function canonicalDomains(value) {
  return [...new Set(array(value).map((id) => domainAliases.get(id) ?? id))];
}

function canonicalEvidenceStatus(value) {
  return ({ "source-located": "locator-reviewed", reviewed: "locator-reviewed", located: "locator-reviewed" })[value] ?? value;
}

function requireFields(object, fields, context, errors) {
  for (const field of fields) if (object[field] === "" || object[field] == null || (Array.isArray(object[field]) && object[field].length === 0)) errors.push(`${context} missing ${field}`);
}

await mkdir(importDir, { recursive: true });
const files = (await readdir(importDir)).filter((name) => name.endsWith(".json")).sort();
if (!files.length) throw new Error(`No JSON batches found in ${importDir}`);

const batches = [];
for (const file of files) {
  const batch = JSON.parse(await readFile(path.join(importDir, file), "utf8"));
  batch.file = file;
  batches.push(batch);
}

const [people, peopleI18n, portraits, taxonomy, sourceRows, statuses, personSources, coverageRows, claims, texts, claimSources, excerpts, relations, relationTexts, relationEvidence, reviews] = await Promise.all([
  csv(path.join(dataDir, "people.csv")),
  csv(path.join(dataDir, "people_i18n.csv")),
  csv(path.join(dataDir, "portraits.csv")),
  csv(path.join(dataDir, "taxonomies.csv")),
  csv(path.join(dataDir, "sources.csv")),
  csv(path.join(researchDir, "people_status.csv")),
  csv(path.join(researchDir, "person_sources.csv")),
  csv(path.join(researchDir, "person_coverage.csv")),
  csv(path.join(researchDir, "claims.csv")),
  csv(path.join(researchDir, "claim_texts.csv")),
  csv(path.join(researchDir, "claim_sources.csv")),
  csv(path.join(researchDir, "source_excerpts.csv")),
  csv(path.join(researchDir, "relations.csv")),
  csv(path.join(researchDir, "relation_texts.csv")),
  csv(path.join(researchDir, "relation_evidence.csv")),
  csv(path.join(researchDir, "review_events.csv")),
]);

const errors = [];
const peopleMap = new Map(people.map((row) => [row.id, row]));
const peopleI18nMap = new Map(peopleI18n.map((row) => [row.id, row]));
const portraitMap = new Map(portraits.map((row) => [row.person_id, row]));
const personIds = new Set(people.map((row) => row.id));
const domainIds = new Set(taxonomy.filter((row) => row.kind === "domain").map((row) => row.id));
const periodIds = new Set(taxonomy.filter((row) => row.kind === "period").map((row) => row.id));
const traditionIds = new Set(taxonomy.filter((row) => row.kind === "tradition").map((row) => row.id));
const sourceMap = new Map(sourceRows.map((row) => [row.id, row]));
const statusMap = new Map(statuses.map((row) => [row.person_id, row]));
const personSourceMap = new Map(personSources.map((row) => [`${row.person_id}:${row.source_id}`, row]));
const coverageMap = new Map(coverageRows.map((row) => [`${row.person_id}:${row.coverage_dimension}`, row]));
const claimMap = new Map(claims.map((row) => [row.claim_id, row]));
const textMap = new Map(texts.map((row) => [`${row.claim_id}:${row.locale}`, row]));
const sourceLinkMap = new Map(claimSources.map((row) => [`${row.claim_id}:${row.source_id}:${row.locator}`, row]));
const excerptMap = new Map(excerpts.map((row) => [row.excerpt_id, row]));
const relationMap = new Map(relations.map((row) => [row.relation_id, row]));
const relationTextMap = new Map(relationTexts.map((row) => [`${row.relation_id}:${row.locale}`, row]));
const relationEvidenceKey = (row) => `${row.relation_id}:${row.evidence_role}:${row.source_id}:${row.locator}:${row.excerpt_id}`;
const relationEvidenceMap = new Map(relationEvidence.map((row) => [relationEvidenceKey(row), row]));
const reviewMap = new Map(reviews.map((row) => [row.review_id, row]));
const seenText = new Map(texts.filter((row) => row.locale === "zh-CN").map((row) => [`${claimMap.get(row.claim_id)?.person_id}:${row.text.replaceAll(/\s/g, "")}`, row.claim_id]));
const allowedSourceTypes = new Set(["primary-text", "digital-text-corpus", "critical-edition", "scholarly-encyclopedia", "scholarly-book", "scholarly-reference", "peer-reviewed-article", "conference-paper", "university-press", "official-primary-source"]);

function canonicalSourceType(value) {
  return String(value ?? "").trim().replaceAll("_", "-");
}

function isPublishableSourceType(value) {
  if (allowedSourceTypes.has(value) || value.startsWith("primary-text-") || value.startsWith("scholarly-")) return true;
  const researchSourceMarkers = ["primary", "text", "commentary", "edition", "facsimile", "fragment", "report", "record", "biograph", "inscription", "compilation", "diary", "lecture", "received", "excavated", "anthology", "peer-reviewed", "university-press", "academic-", "secondary-summary", "scholarly-transcription", "author-manuscript", "author-book"];
  return researchSourceMarkers.some((marker) => value.includes(marker));
}

let imported = 0;
let importedPeople = 0;
let importedRelations = 0;
const incomingSourceDefinitions = new Map();
for (const batch of batches) for (const source of batch.sources ?? []) {
  const previous = incomingSourceDefinitions.get(source.id);
  if (previous && previous.url !== source.url) errors.push(`conflicting source ${source.id} across active batches`);
  incomingSourceDefinitions.set(source.id, source);
}
for (const batch of batches) {
  requireFields(batch, ["batch_id", "reviewer"], `batch ${batch.file}`, errors);
  if (!(batch.claims?.length || batch.relations?.length || batch.people?.length)) errors.push(`batch ${batch.file} has no importable records`);
  const expectedClaimIds = new Set((batch.claims ?? []).map((row) => row.claim_id));
  const expectedRelationIds = new Set((batch.relations ?? []).map((row) => row.relation_id));
  for (const review of reviews.filter((row) => String(row.note).startsWith(`Imported from ${batch.batch_id};`))) {
    if (review.entity_type === "claim" && !expectedClaimIds.has(review.entity_id)) {
      claimMap.delete(review.entity_id);
      for (const key of [...textMap.keys()]) if (key.startsWith(`${review.entity_id}:`)) textMap.delete(key);
      for (const key of [...sourceLinkMap.keys()]) if (key.startsWith(`${review.entity_id}:`)) sourceLinkMap.delete(key);
      excerptMap.delete(`ex-${review.entity_id}`);
      reviewMap.delete(review.review_id);
    }
    if (review.entity_type === "relation" && !expectedRelationIds.has(review.entity_id)) {
      relationMap.delete(review.entity_id);
      for (const key of [...relationTextMap.keys()]) if (key.startsWith(`${review.entity_id}:`)) relationTextMap.delete(key);
      for (const key of [...relationEvidenceMap.keys()]) if (key.startsWith(`${review.entity_id}:`)) relationEvidenceMap.delete(key);
      for (const key of [...excerptMap.keys()]) if (key.startsWith(`ex-${review.entity_id}-`)) excerptMap.delete(key);
      reviewMap.delete(review.review_id);
    }
  }
  for (const source of batch.sources ?? []) {
    requireFields(source, ["id", "type", "title", "url", "citation_zh", "citation_en"], `source ${source.id ?? "<missing>"}`, errors);
    source.type = canonicalSourceType(source.type);
    if (!isPublishableSourceType(source.type)) errors.push(`source ${source.id} has non-publishable type ${source.type}`);
    sourceMap.set(source.id, source);
  }
  for (const person of batch.people ?? []) {
    requireFields(person, ["id", "name_zh", "name_en", "active_year", "dating", "historicity", "period", "domains", "importance", "source_ids"], `person ${person.id ?? "<missing>"}`, errors);
    if (!periodIds.has(person.period)) errors.push(`unknown period ${person.period} on ${person.id}`);
    for (const id of canonicalDomains(person.domains)) if (!domainIds.has(id)) errors.push(`unknown domain ${id} on ${person.id}`);
    for (const id of array(person.traditions)) if (!traditionIds.has(id)) errors.push(`unknown tradition ${id} on ${person.id}`);
    const personSourceIds = array(person.source_ids);
    for (const id of personSourceIds) if (!sourceMap.has(id)) errors.push(`unknown source ${id} on person ${person.id}`);
    if (peopleMap.has(person.id)) continue;
    peopleMap.set(person.id, {
      id: person.id,
      birth_year: person.birth_year ?? "",
      death_year: person.death_year ?? "",
      active_year: person.active_year,
      dating: person.dating,
      historicity: person.historicity,
      period: person.period,
      traditions: array(person.traditions).join(";"),
      domains: canonicalDomains(person.domains).join(";"),
      importance: person.importance,
      review_status: "source-reviewed",
      source_ids: personSourceIds.join(";"),
    });
    peopleI18nMap.set(person.id, { id: person.id, name_zh: person.name_zh, name_en: person.name_en, aliases_zh: array(person.aliases_zh).join(";"), aliases_en: array(person.aliases_en).join(";") });
    portraitMap.set(person.id, { person_id: person.id, kind: "neutral-placeholder", local_path: "/portraits/_neutral.svg", wikidata_id: "", source_url: "", file_title: "", author: "", license: "", license_url: "", review_status: "not-applicable", match_method: "research-batch-placeholder", notes: "No reliably identified reusable portrait in the reviewed batch." });
    statusMap.set(person.id, { person_id: person.id, inclusion_status: "included", inclusion_basis: "philosophical-contribution", priority: "2", target_depth: "standard", research_status: "claims-reviewed", source_discovery_status: "sources-identified", primary_text_status: "corpus-or-text-identified", claim_extraction_status: "batch-reviewed", published_claim_count: "0", identified_source_count: String(personSourceIds.length), next_gate: "expand-system-coverage", reviewer: batch.reviewer, last_audited_at: today });
    for (const sourceId of personSourceIds) personSourceMap.set(`${person.id}:${sourceId}`, { person_id: person.id, source_id: sourceId, source_role: "identity-and-orientation", evidence_scope: "person-or-tradition", locator: "", verification_status: "identified", reviewer: batch.reviewer, reviewed_at: today });
    for (const dimension of [...new Set([...canonicalDomains(person.domains), "intellectual-development", "primary-works"])]) coverageMap.set(`${person.id}:${dimension}`, { person_id: person.id, coverage_dimension: dimension, applicability: "applicable", source_status: "identified", extraction_status: "batch-reviewed", canonical_claim_count: "0", saturation_status: "not-assessed", gap_code: "expand-system-coverage", reviewer: batch.reviewer, reviewed_at: today });
    personIds.add(person.id);
    importedPeople += 1;
  }
  for (const claim of batch.claims ?? []) {
    requireFields(claim, ["claim_id", "person_id", "active_year", "sort_order", "domain_ids", "text_zh", "text_en", "explanation_zh", "explanation_en", "tags_zh", "tags_en", "source_id", "locator", "excerpt_text", "source_language"], `claim ${claim.claim_id ?? "<missing>"}`, errors);
    if (!personIds.has(claim.person_id)) errors.push(`unknown person ${claim.person_id} on ${claim.claim_id}`);
    for (const id of canonicalDomains(claim.domain_ids)) if (!domainIds.has(id)) errors.push(`unknown domain ${id} on ${claim.claim_id}`);
    if (!sourceMap.has(claim.source_id)) errors.push(`unknown source ${claim.source_id} on ${claim.claim_id}`);
    const duplicateKey = `${claim.person_id}:${String(claim.text_zh).replaceAll(/\s/g, "")}`;
    const duplicate = seenText.get(duplicateKey);
    if (duplicate && duplicate !== claim.claim_id) errors.push(`exact within-person duplicate ${claim.claim_id} = ${duplicate}`);
    seenText.set(duplicateKey, claim.claim_id);
    const reviewer = batch.reviewer;
    claimMap.set(claim.claim_id, {
      claim_id: claim.claim_id,
      person_id: claim.person_id,
      content_type: "position",
      active_year: String(claim.active_year),
      sort_order: String(claim.sort_order),
      is_introductory: String(claim.is_introductory ?? true),
      domain_ids: canonicalDomains(claim.domain_ids).join(";"),
      research_status: "canonical",
      source_review_status: "source-reviewed",
      translation_review_status: "bilingual-reviewed",
      dedup_review_status: "reviewed",
      publish_status: "published",
      canonical_key: claim.claim_id,
      period_note: claim.attribution_note ?? "",
      reviewer,
      reviewed_at: today,
    });
    textMap.set(`${claim.claim_id}:zh-CN`, { claim_id: claim.claim_id, locale: "zh-CN", text: claim.text_zh, explanation: claim.explanation_zh, tags: array(claim.tags_zh).join(";"), translation_status: "reviewed", translator: reviewer, reviewer, reviewed_at: today });
    textMap.set(`${claim.claim_id}:en`, { claim_id: claim.claim_id, locale: "en", text: claim.text_en, explanation: claim.explanation_en, tags: array(claim.tags_en).join(";"), translation_status: "reviewed", translator: reviewer, reviewer, reviewed_at: today });
    const excerptId = `ex-${claim.claim_id}`;
    excerptMap.set(excerptId, { excerpt_id: excerptId, person_id: claim.person_id, source_id: claim.source_id, locator: claim.locator, source_language: claim.source_language, excerpt_text: claim.excerpt_text, retrieved_at: today, extraction_status: "locator-reviewed", extractor: reviewer, reviewer });
    const evidenceSource = sourceMap.get(claim.source_id);
    const secondaryMarkers = ["scholarly-", "peer-reviewed", "university-press", "academic-", "secondary-summary"];
    const evidenceRole = secondaryMarkers.some((marker) => evidenceSource?.type.includes(marker)) ? "secondary" : "primary";
    sourceLinkMap.set(`${claim.claim_id}:${claim.source_id}:${claim.locator}`, { claim_id: claim.claim_id, source_id: claim.source_id, locator: claim.locator, evidence_role: evidenceRole, excerpt_id: excerptId, evidence_status: "locator-reviewed", reviewer, reviewed_at: today });
    reviewMap.set(`batch-${claim.claim_id}`, { review_id: `batch-${claim.claim_id}`, entity_type: "claim", entity_id: claim.claim_id, review_dimension: "source-and-bilingual-batch-review", decision: "accepted-for-publication", reviewer, reviewed_at: today, note: `Imported from ${batch.batch_id}; attribution: ${claim.attribution_note ?? "not-specified"}`, previous_revision: "", new_revision: "1" });
    imported += 1;
  }
  for (const relation of batch.relations ?? []) {
    requireFields(relation, ["relation_id", "source_claim_id", "target_claim_id", "polarity", "subtype", "basis", "direction", "historical_influence", "note_zh", "note_en"], `relation ${relation.relation_id ?? "<missing>"}`, errors);
    const evidenceEntries = relation.evidence?.length ? relation.evidence : [{ source_id: relation.source_id, locator: relation.locator, excerpt_text: relation.excerpt_text, evidence_role: relation.evidence_role, evidence_status: relation.evidence_status, source_language: relation.source_language }];
    for (const [index, evidence] of evidenceEntries.entries()) requireFields(evidence, ["source_id", "locator", "excerpt_text", "evidence_role", "evidence_status"], `relation evidence ${relation.relation_id ?? "<missing>"}#${index + 1}`, errors);
    if (!claimMap.has(relation.source_claim_id) || !claimMap.has(relation.target_claim_id)) errors.push(`unknown endpoint on ${relation.relation_id}`);
    if (!["positive", "negative"].includes(relation.polarity)) errors.push(`invalid polarity on ${relation.relation_id}`);
    if (!["conceptual-only", "probable", "explicit"].includes(relation.historical_influence)) errors.push(`invalid influence level on ${relation.relation_id}`);
    for (const evidence of evidenceEntries) {
      evidence.evidence_status = canonicalEvidenceStatus(evidence.evidence_status);
      if (!sourceMap.has(evidence.source_id)) errors.push(`unknown source ${evidence.source_id} on ${relation.relation_id}`);
      if (!["locator-reviewed", "excerpt-reviewed"].includes(evidence.evidence_status)) errors.push(`unreviewed relation locator on ${relation.relation_id}`);
    }
    const directEvidenceMarkers = ["direct", "explicit", "genealogy", "disciple", "teacher", "polemic", "transmission", "historical-debate", "historical-influence"];
    if (relation.historical_influence === "explicit" && !evidenceEntries.some((evidence) => evidence.locator && evidence.excerpt_text && directEvidenceMarkers.some((marker) => evidence.evidence_role.includes(marker)))) errors.push(`explicit influence lacks direct located evidence on ${relation.relation_id}`);
    const reviewer = batch.reviewer;
    const sourceClaim = claimMap.get(relation.source_claim_id);
    for (const [index, evidence] of evidenceEntries.entries()) {
      const relationExcerptId = `ex-${relation.relation_id}-${index + 1}`;
      excerptMap.set(relationExcerptId, { excerpt_id: relationExcerptId, person_id: evidence.person_id ?? sourceClaim?.person_id ?? "", source_id: evidence.source_id, locator: evidence.locator, source_language: evidence.source_language ?? "zh-Hans-modern", excerpt_text: evidence.excerpt_text, retrieved_at: today, extraction_status: evidence.evidence_status, extractor: reviewer, reviewer });
      const evidenceRow = { relation_id: relation.relation_id, source_id: evidence.source_id, locator: evidence.locator, excerpt_id: relationExcerptId, evidence_role: evidence.evidence_role, evidence_status: evidence.evidence_status, reviewer, reviewed_at: today };
      relationEvidenceMap.set(relationEvidenceKey(evidenceRow), evidenceRow);
    }
    relationMap.set(relation.relation_id, { relation_id: relation.relation_id, source_claim_id: relation.source_claim_id, target_claim_id: relation.target_claim_id, polarity: relation.polarity, subtype: relation.subtype, basis: relation.basis, direction: relation.direction, historical_influence: relation.historical_influence, evidence_review_status: "located-evidence-reviewed", relation_review_status: "reviewed", publish_status: "published", reviewer, reviewed_at: today });
    relationTextMap.set(`${relation.relation_id}:zh-CN`, { relation_id: relation.relation_id, locale: "zh-CN", note: relation.note_zh, translation_status: "reviewed", reviewer, reviewed_at: today });
    relationTextMap.set(`${relation.relation_id}:en`, { relation_id: relation.relation_id, locale: "en", note: relation.note_en, translation_status: "reviewed", reviewer, reviewed_at: today });
    reviewMap.set(`batch-${relation.relation_id}`, { review_id: `batch-${relation.relation_id}`, entity_type: "relation", entity_id: relation.relation_id, review_dimension: "relation-evidence-and-bilingual-review", decision: "accepted-for-publication", reviewer, reviewed_at: today, note: `Imported from ${batch.batch_id}; influence level: ${relation.historical_influence}`, previous_revision: "", new_revision: "1" });
    importedRelations += 1;
  }
}

const duplicateGroups = new Map();
for (const relation of relationMap.values()) {
  const endpoints = relation.direction === "undirected"
    ? [relation.source_claim_id, relation.target_claim_id].sort()
    : [relation.source_claim_id, relation.target_claim_id];
  const signature = `${endpoints.join("|")}|${relation.polarity}|${relation.subtype}|${relation.direction}`;
  const group = duplicateGroups.get(signature) ?? [];
  group.push(relation);
  duplicateGroups.set(signature, group);
}
for (const group of duplicateGroups.values()) {
  if (group.length < 2) continue;
  const score = (relation) => {
    const evidence = [...relationEvidenceMap.values()].filter((row) => row.relation_id === relation.relation_id);
    const located = evidence.filter((row) => row.locator && row.excerpt_id && ["locator-reviewed", "excerpt-reviewed"].includes(row.evidence_status)).length;
    const influence = ({ explicit: 3, probable: 2, "conceptual-only": 1 })[relation.historical_influence] ?? 0;
    return located * 20 + influence * 3 + (relation.relation_review_status === "reviewed" ? 1 : 0);
  };
  const [winner, ...losers] = [...group].sort((a, b) => score(b) - score(a) || a.relation_id.localeCompare(b.relation_id));
  for (const loser of losers) {
    relationMap.delete(loser.relation_id);
    for (const key of [...relationTextMap.keys()]) if (key.startsWith(`${loser.relation_id}:`)) relationTextMap.delete(key);
    for (const key of [...relationEvidenceMap.keys()]) if (key.startsWith(`${loser.relation_id}:`)) relationEvidenceMap.delete(key);
    for (const key of [...excerptMap.keys()]) if (key.startsWith(`ex-${loser.relation_id}-`)) excerptMap.delete(key);
    reviewMap.set(`dedupe-${loser.relation_id}`, { review_id: `dedupe-${loser.relation_id}`, entity_type: "relation", entity_id: loser.relation_id, review_dimension: "exact-edge-deduplication", decision: "removed-as-duplicate", reviewer: "batch-import-quality-gate", reviewed_at: today, note: `Duplicate of ${winner.relation_id}; retained higher-evidence edge.`, previous_revision: loser.relation_id, new_revision: winner.relation_id });
  }
}

// Curated audit repairs that must survive idempotent batch re-imports. These
// merge only semantically redundant edges; broader analytical and historical
// layers with the same endpoints remain separate.
const auditedDuplicatePairs = [
  ["density-c-17e22c26258b2a", "density-xp-songqing-modern-03-jiao-xun-nature-capacity-through-practice-cai-yuanpei-education-personality"],
  ["density-c-79c7df8071a1da", "density-xp-songqing-modern-16-ma-zhu-divine-unity-obedience-tan-sitong-ren-as-communication"],
  ["rel-confucius-harmony-superior", "rel-confucius-harmony-junzi"],
  ["rel-mozi-care-xunzi-ritual", "rel-xunzi-mozi-ritual-frugality"],
  ["rel-xunzi-rectification-ritual", "rel-xunzi-rectification-order"],
  ["density-c-1ea446a41e0e1a", "density-xp-hantang-songqing-02-zhi-dun-freedom-not-mere-satisfaction-wang-ji-four-nothings"],
];
for (const [loserId, winnerId] of auditedDuplicatePairs) {
  if (!relationMap.has(loserId) || !relationMap.has(winnerId)) continue;
  for (const [key, evidence] of [...relationEvidenceMap]) {
    if (evidence.relation_id !== loserId) continue;
    relationEvidenceMap.delete(key);
    const merged = { ...evidence, relation_id: winnerId, reviewer: "independent-relation-audit", reviewed_at: today };
    relationEvidenceMap.set(relationEvidenceKey(merged), merged);
  }
  relationMap.delete(loserId);
  for (const key of [...relationTextMap.keys()]) if (key.startsWith(`${loserId}:`)) relationTextMap.delete(key);
  reviewMap.set(`audit-dedupe-${loserId}`, { review_id: `audit-dedupe-${loserId}`, entity_type: "relation", entity_id: loserId, review_dimension: "independent-semantic-deduplication", decision: "removed-as-duplicate", reviewer: "independent-relation-audit", reviewed_at: today, note: `Merged evidence into ${winnerId}.`, previous_revision: loserId, new_revision: winnerId });
}

// A historical-influence level is not meaningful between two claims by the
// same author. Preserve the systematic link without asserting transmission.
for (const relation of relationMap.values()) {
  const sourcePerson = claimMap.get(relation.source_claim_id)?.person_id;
  const targetPerson = claimMap.get(relation.target_claim_id)?.person_id;
  if (sourcePerson && sourcePerson === targetPerson && relation.historical_influence === "explicit") {
    relation.historical_influence = "conceptual-only";
    relation.basis = "editorial";
    relation.reviewer = "independent-relation-audit";
    relation.reviewed_at = today;
  }
}

// Correct a legacy attribution and make every evidence row inherit canonical
// source and locator metadata from its referenced excerpt.
const daiZhenExcerpt = excerptMap.get("ex-sq-cy-dz-desire-contrast-1");
if (daiZhenExcerpt) daiZhenExcerpt.person_id = "dai-zhen";
for (const [key, evidence] of [...relationEvidenceMap]) {
  const excerpt = excerptMap.get(evidence.excerpt_id);
  if (!excerpt) continue;
  relationEvidenceMap.delete(key);
  const repaired = { ...evidence, source_id: excerpt.source_id, locator: excerpt.locator };
  relationEvidenceMap.set(relationEvidenceKey(repaired), repaired);
}

// This legacy edge is an analytical comparison; its notes must not claim a
// historical influence that the attached endpoint evidence does not prove.
const rectificationNotes = {
  "zh-CN": "荀子正名与法家名实术都关注名称、职责与实际表现的对应，但目标不同：荀子以正名维护礼治秩序，法家则将名实关系用于考核臣下。本关系仅表示概念比较，不主张历史影响。",
  en: "Xunzi's rectification of names and Legalist name-performance techniques both connect titles, duties, and actual performance, but serve different political aims. This is a conceptual comparison, not a claim of historical influence.",
};
for (const [locale, note] of Object.entries(rectificationNotes)) {
  const row = relationTextMap.get(`rel-xunzi-hanfei-rectification:${locale}`);
  if (row) Object.assign(row, { note, reviewer: "independent-relation-audit", reviewed_at: today });
}

// Older editorial edges often carried only a source ID. Reuse the already
// reviewed endpoint excerpts as relation support, then discard blank evidence
// stubs once a located record exists. This does not upgrade influence level.
for (const relation of relationMap.values()) {
  for (const [claimId, role] of [[relation.source_claim_id, "source-claim-support"], [relation.target_claim_id, "target-claim-support"]]) {
    const link = [...sourceLinkMap.values()].find((row) => row.claim_id === claimId && row.locator && row.excerpt_id && ["locator-reviewed", "excerpt-reviewed"].includes(row.evidence_status));
    if (!link) continue;
    const evidenceRow = { relation_id: relation.relation_id, source_id: link.source_id, locator: link.locator, excerpt_id: link.excerpt_id, evidence_role: role, evidence_status: link.evidence_status, reviewer: "batch-import-quality-gate", reviewed_at: today };
    relationEvidenceMap.set(relationEvidenceKey(evidenceRow), evidenceRow);
  }
  const located = [...relationEvidenceMap.values()].some((row) => row.relation_id === relation.relation_id && row.locator && row.excerpt_id);
  if (located) for (const [key, row] of relationEvidenceMap) if (row.relation_id === relation.relation_id && (!row.locator || !row.excerpt_id)) relationEvidenceMap.delete(key);
}

// Endpoint backfilling can reuse a legacy claim-source row whose locator was
// superseded by the canonical excerpt. Reconcile once more after backfilling
// and collapse the now-identical evidence keys.
for (const [key, evidence] of [...relationEvidenceMap]) {
  const excerpt = excerptMap.get(evidence.excerpt_id);
  if (!excerpt) continue;
  relationEvidenceMap.delete(key);
  const canonical = { ...evidence, source_id: excerpt.source_id, locator: excerpt.locator };
  relationEvidenceMap.set(relationEvidenceKey(canonical), canonical);
}

if (errors.length) {
  console.error(`Batch import rejected with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const byClaimOrder = (a, b) => Number(a.active_year) - Number(b.active_year) || a.person_id.localeCompare(b.person_id) || Number(a.sort_order) - Number(b.sort_order) || a.claim_id.localeCompare(b.claim_id);
const sortedClaims = [...claimMap.values()].sort(byClaimOrder);
const claimOrder = new Map(sortedClaims.map((row, index) => [row.claim_id, index]));

await Promise.all([
  writeCsv(path.join(dataDir, "people.csv"), ["id", "birth_year", "death_year", "active_year", "dating", "historicity", "period", "traditions", "domains", "importance", "review_status", "source_ids"], [...peopleMap.values()].sort((a, b) => Number(a.active_year) - Number(b.active_year) || a.id.localeCompare(b.id))),
  writeCsv(path.join(dataDir, "people_i18n.csv"), ["id", "name_zh", "name_en", "aliases_zh", "aliases_en"], [...peopleI18nMap.values()].sort((a, b) => (peopleMap.get(a.id)?.active_year ?? 0) - (peopleMap.get(b.id)?.active_year ?? 0) || a.id.localeCompare(b.id))),
  writeCsv(path.join(dataDir, "portraits.csv"), ["person_id", "kind", "local_path", "wikidata_id", "source_url", "file_title", "author", "license", "license_url", "review_status", "match_method", "notes"], [...portraitMap.values()].sort((a, b) => (peopleMap.get(a.person_id)?.active_year ?? 0) - (peopleMap.get(b.person_id)?.active_year ?? 0) || a.person_id.localeCompare(b.person_id))),
  writeCsv(path.join(dataDir, "sources.csv"), ["id", "type", "title", "url", "citation_zh", "citation_en"], [...sourceMap.values()].sort((a, b) => a.id.localeCompare(b.id))),
  writeCsv(path.join(researchDir, "people_status.csv"), ["person_id", "inclusion_status", "inclusion_basis", "priority", "target_depth", "research_status", "source_discovery_status", "primary_text_status", "claim_extraction_status", "published_claim_count", "identified_source_count", "next_gate", "reviewer", "last_audited_at"], [...statusMap.values()].sort((a, b) => (peopleMap.get(a.person_id)?.active_year ?? 0) - (peopleMap.get(b.person_id)?.active_year ?? 0))),
  writeCsv(path.join(researchDir, "person_sources.csv"), ["person_id", "source_id", "source_role", "evidence_scope", "locator", "verification_status", "reviewer", "reviewed_at"], [...personSourceMap.values()].sort((a, b) => a.person_id.localeCompare(b.person_id) || a.source_id.localeCompare(b.source_id))),
  writeCsv(path.join(researchDir, "person_coverage.csv"), ["person_id", "coverage_dimension", "applicability", "source_status", "extraction_status", "canonical_claim_count", "saturation_status", "gap_code", "reviewer", "reviewed_at"], [...coverageMap.values()].sort((a, b) => a.person_id.localeCompare(b.person_id) || a.coverage_dimension.localeCompare(b.coverage_dimension))),
  writeCsv(path.join(researchDir, "claims.csv"), ["claim_id", "person_id", "content_type", "active_year", "sort_order", "is_introductory", "domain_ids", "research_status", "source_review_status", "translation_review_status", "dedup_review_status", "publish_status", "canonical_key", "period_note", "reviewer", "reviewed_at"], sortedClaims),
  writeCsv(path.join(researchDir, "claim_texts.csv"), ["claim_id", "locale", "text", "explanation", "tags", "translation_status", "translator", "reviewer", "reviewed_at"], [...textMap.values()].sort((a, b) => (claimOrder.get(a.claim_id) ?? 0) - (claimOrder.get(b.claim_id) ?? 0) || a.locale.localeCompare(b.locale))),
  writeCsv(path.join(researchDir, "claim_sources.csv"), ["claim_id", "source_id", "locator", "evidence_role", "excerpt_id", "evidence_status", "reviewer", "reviewed_at"], [...sourceLinkMap.values()].sort((a, b) => (claimOrder.get(a.claim_id) ?? 0) - (claimOrder.get(b.claim_id) ?? 0))),
  writeCsv(path.join(researchDir, "source_excerpts.csv"), ["excerpt_id", "person_id", "source_id", "locator", "source_language", "excerpt_text", "retrieved_at", "extraction_status", "extractor", "reviewer"], [...excerptMap.values()].sort((a, b) => a.person_id.localeCompare(b.person_id) || a.excerpt_id.localeCompare(b.excerpt_id))),
  writeCsv(path.join(researchDir, "relations.csv"), ["relation_id", "source_claim_id", "target_claim_id", "polarity", "subtype", "basis", "direction", "historical_influence", "evidence_review_status", "relation_review_status", "publish_status", "reviewer", "reviewed_at"], [...relationMap.values()].sort((a, b) => a.relation_id.localeCompare(b.relation_id))),
  writeCsv(path.join(researchDir, "relation_texts.csv"), ["relation_id", "locale", "note", "translation_status", "reviewer", "reviewed_at"], [...relationTextMap.values()].sort((a, b) => a.relation_id.localeCompare(b.relation_id) || a.locale.localeCompare(b.locale))),
  writeCsv(path.join(researchDir, "relation_evidence.csv"), ["relation_id", "source_id", "locator", "excerpt_id", "evidence_role", "evidence_status", "reviewer", "reviewed_at"], [...relationEvidenceMap.values()].sort((a, b) => a.relation_id.localeCompare(b.relation_id) || a.source_id.localeCompare(b.source_id))),
  writeCsv(path.join(researchDir, "review_events.csv"), ["review_id", "entity_type", "entity_id", "review_dimension", "decision", "reviewer", "reviewed_at", "note", "previous_revision", "new_revision"], [...reviewMap.values()].sort((a, b) => a.review_id.localeCompare(b.review_id))),
]);

console.log(`Imported ${importedPeople} people, ${imported} claims, and ${importedRelations} relations from ${batches.length} research batch(es). Research layer now contains ${sortedClaims.length} claims for ${new Set(sortedClaims.map((row) => row.person_id)).size} people.`);
