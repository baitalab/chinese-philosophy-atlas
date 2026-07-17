import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

const root = process.cwd();
const dataDir = path.join(root, "data");

async function csv(name) {
  const text = await readFile(path.join(dataDir, name), "utf8");
  return parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true });
}

function split(value) {
  return value ? value.split(";").map((item) => item.trim()).filter(Boolean) : [];
}

function numberOrNull(value) {
  return value === "" || value == null ? null : Number(value);
}

function fail(errors, message) {
  errors.push(message);
}

async function atomicWrite(filePath, contents) {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, contents, "utf8");
  await rename(temporaryPath, filePath);
}

const [peopleRows, i18nRows, portraitRows, sourceRows, taxonomyRows, statementRows, statementTranslationRows, statementSourceRows, relationRows, relationTranslationRows] = await Promise.all([
  csv("people.csv"),
  csv("people_i18n.csv"),
  csv("portraits.csv"),
  csv("sources.csv"),
  csv("taxonomies.csv"),
  csv("statements.csv"),
  csv("statement_translations.csv"),
  csv("statement_sources.csv"),
  csv("statement_relations.csv"),
  csv("relation_translations.csv"),
]);

const errors = [];
const ids = new Set();
const sources = new Map(sourceRows.map((source) => [source.id, source]));
const taxonomies = new Map(taxonomyRows.map((item) => [`${item.kind}:${item.id}`, item]));
const translations = new Map(i18nRows.map((row) => [row.id, row]));
const portraits = new Map(portraitRows.map((row) => [row.person_id, row]));
const statementIds = new Set(statementRows.map((row) => row.id));
const statementTypes = new Map(statementRows.map((row) => [row.id, row.content_type]));
const statementTranslations = new Map(statementTranslationRows.map((row) => [`${row.statement_id}:${row.locale}`, row]));
const relationIds = new Set(relationRows.map((row) => row.id));
const relationTranslations = new Map(relationTranslationRows.map((row) => [`${row.relation_id}:${row.locale}`, row]));

function duplicateValues(rows, key) {
  const seen = new Set();
  const duplicates = new Set();
  for (const row of rows) {
    const value = key(row);
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

for (const id of duplicateValues(sourceRows, (row) => row.id)) fail(errors, `duplicate source id: ${id}`);
for (const id of duplicateValues(taxonomyRows, (row) => `${row.kind}:${row.id}`)) fail(errors, `duplicate taxonomy id: ${id}`);
for (const id of duplicateValues(i18nRows, (row) => row.id)) fail(errors, `duplicate person translation id: ${id}`);
for (const id of duplicateValues(portraitRows, (row) => row.person_id)) fail(errors, `duplicate portrait row: ${id}`);
for (const id of duplicateValues(statementRows, (row) => row.id)) fail(errors, `duplicate statement id: ${id}`);
for (const id of duplicateValues(statementTranslationRows, (row) => `${row.statement_id}:${row.locale}`)) fail(errors, `duplicate statement translation: ${id}`);
for (const id of duplicateValues(statementSourceRows, (row) => `${row.statement_id}:${row.source_id}:${row.locator}`)) fail(errors, `duplicate statement source link: ${id}`);
for (const id of duplicateValues(relationRows, (row) => row.id)) fail(errors, `duplicate relation id: ${id}`);
for (const id of duplicateValues(relationTranslationRows, (row) => `${row.relation_id}:${row.locale}`)) fail(errors, `duplicate relation translation: ${id}`);

for (const row of peopleRows) {
  if (!row.id) fail(errors, "people.csv contains a row without id");
  if (ids.has(row.id)) fail(errors, `duplicate person id: ${row.id}`);
  ids.add(row.id);
  if (!translations.has(row.id)) fail(errors, `missing bilingual name row: ${row.id}`);
  if (!portraits.has(row.id)) fail(errors, `missing portrait row: ${row.id}`);
  if (!taxonomies.has(`period:${row.period}`)) fail(errors, `unknown period ${row.period} on ${row.id}`);
  for (const id of split(row.traditions)) if (!taxonomies.has(`tradition:${id}`)) fail(errors, `unknown tradition ${id} on ${row.id}`);
  for (const id of split(row.domains)) if (!taxonomies.has(`domain:${id}`)) fail(errors, `unknown domain ${id} on ${row.id}`);
  for (const id of split(row.source_ids)) if (!sources.has(id)) fail(errors, `unknown source ${id} on ${row.id}`);
  const active = Number(row.active_year);
  if (!Number.isFinite(active) || active < -4000 || active > new Date().getUTCFullYear()) fail(errors, `invalid active_year on ${row.id}`);
  const birth = numberOrNull(row.birth_year);
  const death = numberOrNull(row.death_year);
  if (birth !== null && death !== null && birth > death) fail(errors, `birth after death on ${row.id}`);
}

for (const row of i18nRows) {
  if (!ids.has(row.id)) fail(errors, `orphan translation row: ${row.id}`);
  if (!row.name_zh || !row.name_en) fail(errors, `missing zh/en name on ${row.id}`);
}

for (const row of portraitRows) {
  if (!ids.has(row.person_id)) fail(errors, `orphan portrait row: ${row.person_id}`);
  if (!['sourced-image', 'generated-illustration', 'neutral-placeholder'].includes(row.kind)) fail(errors, `invalid portrait kind on ${row.person_id}`);
  if (!row.local_path.startsWith('/portraits')) fail(errors, `invalid local portrait path on ${row.person_id}`);
  if (row.kind === 'sourced-image' && (!row.wikidata_id || !row.source_url || !row.file_title || !row.license)) fail(errors, `incomplete sourced portrait provenance on ${row.person_id}`);
  if (row.kind === 'generated-illustration' && (!row.file_title || !row.author || !row.license || !row.notes.includes('not a historical likeness'))) fail(errors, `incomplete generated portrait disclosure on ${row.person_id}`);
}

for (const row of statementRows) {
  if (!row.id) fail(errors, "statements.csv contains a row without id");
  if (!ids.has(row.person_id)) fail(errors, `unknown person ${row.person_id} on statement ${row.id}`);
  if (row.content_type !== "position") fail(errors, `public statement content_type must be position: ${row.id}`);
  if (row.review_status !== "source-reviewed") fail(errors, `position must be source-reviewed: ${row.id}`);
  if (!row.reviewer || !/^\d{4}-\d{2}-\d{2}$/.test(row.reviewed_at)) fail(errors, `position review metadata incomplete: ${row.id}`);
  if (!/^\d+$/.test(row.sort_order) || Number(row.sort_order) < 1) fail(errors, `invalid sort_order on ${row.id}`);
  if (!['true', 'false'].includes(row.is_introductory)) fail(errors, `invalid is_introductory on ${row.id}`);
  for (const id of split(row.domain_ids)) if (!taxonomies.has(`domain:${id}`)) fail(errors, `unknown domain ${id} on statement ${row.id}`);
  for (const locale of ["zh-CN", "en"]) if (!statementTranslations.has(`${row.id}:${locale}`)) fail(errors, `missing ${locale} statement translation: ${row.id}`);
  const year = Number(row.active_year);
  if (!Number.isFinite(year) || year < -4000 || year > new Date().getUTCFullYear()) fail(errors, `invalid active_year on statement ${row.id}`);
}

for (const row of statementTranslationRows) {
  if (!statementIds.has(row.statement_id)) fail(errors, `orphan statement translation: ${row.statement_id}`);
  if (!["zh-CN", "en"].includes(row.locale)) fail(errors, `unsupported statement locale ${row.locale} on ${row.statement_id}`);
  if (!row.text || !row.explanation) fail(errors, `incomplete statement translation ${row.locale}: ${row.statement_id}`);
}

for (const row of statementSourceRows) {
  if (!statementIds.has(row.statement_id)) fail(errors, `unknown statement on source link: ${row.statement_id}`);
  if (!sources.has(row.source_id)) fail(errors, `unknown source ${row.source_id} on statement ${row.statement_id}`);
  if (!row.locator) fail(errors, `missing source locator on statement ${row.statement_id}`);
  if (!['primary', 'secondary', 'attribution', 'context'].includes(row.evidence_role)) fail(errors, `invalid evidence role on statement ${row.statement_id}`);
}

for (const statementId of statementIds) {
  if (!statementSourceRows.some((row) => row.statement_id === statementId)) fail(errors, `statement has no source link: ${statementId}`);
}

for (const row of relationRows) {
  if (!row.id) fail(errors, "statement_relations.csv contains a row without id");
  if (!statementIds.has(row.source_statement_id)) fail(errors, `unknown source statement on relation ${row.id}`);
  if (!statementIds.has(row.target_statement_id)) fail(errors, `unknown target statement on relation ${row.id}`);
  if (row.source_statement_id === row.target_statement_id) fail(errors, `self relation ${row.id}`);
  if (statementTypes.get(row.source_statement_id) !== "position" || statementTypes.get(row.target_statement_id) !== "position") fail(errors, `relation endpoints must both be reviewed positions: ${row.id}`);
  if (!["positive", "negative"].includes(row.polarity)) fail(errors, `invalid polarity on relation ${row.id}`);
  if (!["agreement", "expansion", "similarity", "disagreement", "refutation", "contrast"].includes(row.subtype)) fail(errors, `invalid relation subtype on ${row.id}`);
  if (!["primary", "historian", "editorial"].includes(row.basis)) fail(errors, `invalid relation basis on ${row.id}`);
  if (row.direction !== "undirected") fail(errors, `published timeline relation must be undirected: ${row.id}`);
  if (!["conceptual-only", "probable", "explicit"].includes(row.historical_influence)) fail(errors, `invalid historical influence on relation ${row.id}`);
  if (row.review_status !== "reviewed" || !row.reviewer || !/^\d{4}-\d{2}-\d{2}$/.test(row.reviewed_at)) fail(errors, `relation review metadata incomplete: ${row.id}`);
  if (!row.evidence_source_ids) fail(errors, `relation has no evidence source: ${row.id}`);
  for (const id of split(row.evidence_source_ids)) if (!sources.has(id)) fail(errors, `unknown evidence source ${id} on relation ${row.id}`);
  for (const locale of ["zh-CN", "en"]) if (!relationTranslations.has(`${row.id}:${locale}`)) fail(errors, `missing ${locale} relation note: ${row.id}`);
}

for (const row of relationTranslationRows) {
  if (!relationIds.has(row.relation_id)) fail(errors, `orphan relation translation: ${row.relation_id}`);
  if (!row.note) fail(errors, `missing relation note ${row.locale}: ${row.relation_id}`);
}

if (errors.length) {
  console.error(`Data validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const people = peopleRows.map((row) => {
  const text = translations.get(row.id);
  const portrait = portraits.get(row.id);
  return {
    id: row.id,
    birthYear: numberOrNull(row.birth_year),
    deathYear: numberOrNull(row.death_year),
    activeYear: Number(row.active_year),
    dating: row.dating,
    historicity: row.historicity,
    period: row.period,
    traditions: split(row.traditions),
    domains: split(row.domains),
    importance: row.importance,
    reviewStatus: row.review_status,
    sourceIds: split(row.source_ids),
    names: { "zh-CN": text.name_zh, en: text.name_en },
    aliases: { "zh-CN": split(text.aliases_zh), en: split(text.aliases_en) },
    portrait: {
      kind: portrait.kind,
      path: portrait.local_path,
      wikidataId: portrait.wikidata_id,
      sourceUrl: portrait.source_url,
      fileTitle: portrait.file_title,
      author: portrait.author,
      license: portrait.license,
      licenseUrl: portrait.license_url,
      reviewStatus: portrait.review_status,
    },
  };
}).sort((a, b) => a.activeYear - b.activeYear || a.id.localeCompare(b.id));

const taxonomy = taxonomyRows.map((row) => ({
  kind: row.kind,
  id: row.id,
  labels: { "zh-CN": row.label_zh, en: row.label_en },
  color: row.color,
}));

const sourceList = sourceRows.map((row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  url: row.url,
  citations: { "zh-CN": row.citation_zh, en: row.citation_en },
}));

const statementSources = new Map();
for (const row of statementSourceRows) {
  const items = statementSources.get(row.statement_id) ?? [];
  items.push({ sourceId: row.source_id, locator: row.locator, evidenceRole: row.evidence_role });
  statementSources.set(row.statement_id, items);
}

const statements = statementRows.map((row) => ({
  id: row.id,
  personId: row.person_id,
  contentType: row.content_type,
  activeYear: Number(row.active_year),
  order: Number(row.sort_order),
  introductory: row.is_introductory === "true",
  domainIds: split(row.domain_ids),
  reviewStatus: row.review_status,
  reviewer: row.reviewer,
  reviewedAt: row.reviewed_at,
  translations: Object.fromEntries(["zh-CN", "en"].map((locale) => {
    const translation = statementTranslations.get(`${row.id}:${locale}`);
    return [locale, { text: translation.text, explanation: translation.explanation, tags: split(translation.tags) }];
  })),
  sources: statementSources.get(row.id) ?? [],
})).sort((a, b) => a.activeYear - b.activeYear || a.order - b.order || a.id.localeCompare(b.id));

const relations = relationRows.map((row) => ({
  id: row.id,
  sourceStatementId: row.source_statement_id,
  targetStatementId: row.target_statement_id,
  polarity: row.polarity,
  subtype: row.subtype,
  basis: row.basis,
  direction: row.direction,
  historicalInfluence: row.historical_influence,
  reviewStatus: row.review_status,
  reviewer: row.reviewer,
  reviewedAt: row.reviewed_at,
  evidenceSourceIds: split(row.evidence_source_ids),
  notes: Object.fromEntries(["zh-CN", "en"].map((locale) => [locale, relationTranslations.get(`${row.id}:${locale}`).note])),
}));

const coverage = {
  version: "statement-focus-2026-07-14",
  people: people.length,
  byPeriod: Object.fromEntries([...new Set(people.map((person) => person.period))].map((period) => [period, people.filter((person) => person.period === period).length])),
  byHistoricity: Object.fromEntries([...new Set(people.map((person) => person.historicity))].map((status) => [status, people.filter((person) => person.historicity === status).length])),
  sourceReviewed: people.filter((person) => person.reviewStatus === "source-reviewed").length,
  screened: people.filter((person) => person.reviewStatus === "screened").length,
  contentNodes: statements.length,
  positionStatements: statements.filter((statement) => statement.contentType === "position").length,
  peopleWithContent: new Set(statements.map((statement) => statement.personId)).size,
  peopleWithPositions: new Set(statements.filter((statement) => statement.contentType === "position").map((statement) => statement.personId)).size,
  unsourcedContent: statements.filter((statement) => statement.sources.length === 0).length,
  relations: relations.length,
  positiveRelations: relations.filter((relation) => relation.polarity === "positive").length,
  negativeRelations: relations.filter((relation) => relation.polarity === "negative").length,
  sourcedPortraits: people.filter((person) => person.portrait.kind === "sourced-image").length,
  portraitCoverage: people.filter((person) => Boolean(person.portrait.path)).length,
};

const output = { schemaVersion: 4, dataVersion: coverage.version, people, statements, relations, taxonomy, sources: sourceList, coverage };
const generatedDir = path.join(root, "src", "data", "generated");
const reportDir = path.join(dataDir, "reports");
await mkdir(generatedDir, { recursive: true });
await mkdir(reportDir, { recursive: true });
await atomicWrite(path.join(generatedDir, "corpus.json"), `${JSON.stringify(output, null, 2)}\n`);
await atomicWrite(path.join(reportDir, "phase1-coverage.json"), `${JSON.stringify(coverage, null, 2)}\n`);
console.log(`Built ${people.length} people, ${coverage.positionStatements} reviewed positions, ${relations.length} reviewed relations, ${taxonomy.length} taxonomy terms, and ${sourceList.length} sources.`);
