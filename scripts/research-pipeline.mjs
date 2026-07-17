import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";

const root = process.cwd();
const dataDir = path.join(root, "data");
const researchDir = path.join(dataDir, "research");
const reportDir = path.join(dataDir, "reports");
const command = process.argv[2] ?? "validate";

const schemas = {
  "people_status.csv": [
    "person_id", "inclusion_status", "inclusion_basis", "priority", "target_depth",
    "research_status", "source_discovery_status", "primary_text_status",
    "claim_extraction_status", "published_claim_count", "identified_source_count",
    "next_gate", "reviewer", "last_audited_at",
  ],
  "person_sources.csv": [
    "person_id", "source_id", "source_role", "evidence_scope", "locator",
    "verification_status", "reviewer", "reviewed_at",
  ],
  "source_excerpts.csv": [
    "excerpt_id", "person_id", "source_id", "locator", "source_language",
    "excerpt_text", "retrieved_at", "extraction_status", "extractor", "reviewer",
  ],
  "works.csv": [
    "work_id", "canonical_title", "work_type", "composition_start", "composition_end",
    "dating_precision", "authorship_status", "research_status", "reviewer", "reviewed_at",
  ],
  "work_texts.csv": [
    "work_id", "locale", "title", "alternative_titles", "translation_status",
    "reviewer", "reviewed_at",
  ],
  "work_attributions.csv": [
    "attribution_id", "work_id", "person_id", "role", "certainty", "source_id",
    "excerpt_id", "review_status", "reviewer", "reviewed_at",
  ],
  "person_coverage.csv": [
    "person_id", "coverage_dimension", "applicability", "source_status",
    "extraction_status", "canonical_claim_count", "saturation_status", "gap_code",
    "reviewer", "reviewed_at",
  ],
  "claims.csv": [
    "claim_id", "person_id", "content_type", "active_year", "sort_order",
    "is_introductory", "domain_ids", "research_status", "source_review_status",
    "translation_review_status", "dedup_review_status", "publish_status",
    "canonical_key", "period_note", "reviewer", "reviewed_at",
  ],
  "claim_texts.csv": [
    "claim_id", "locale", "text", "explanation", "tags", "translation_status",
    "translator", "reviewer", "reviewed_at",
  ],
  "claim_sources.csv": [
    "claim_id", "source_id", "locator", "evidence_role", "excerpt_id",
    "evidence_status", "reviewer", "reviewed_at",
  ],
  "claim_decisions.csv": [
    "decision_id", "claim_id", "decision", "related_claim_id", "reason_code",
    "note", "reviewer", "reviewed_at",
  ],
  "relations.csv": [
    "relation_id", "source_claim_id", "target_claim_id", "polarity", "subtype",
    "basis", "direction", "historical_influence", "evidence_review_status",
    "relation_review_status", "publish_status", "reviewer", "reviewed_at",
  ],
  "relation_texts.csv": [
    "relation_id", "locale", "note", "translation_status", "reviewer", "reviewed_at",
  ],
  "relation_evidence.csv": [
    "relation_id", "source_id", "locator", "excerpt_id", "evidence_role",
    "evidence_status", "reviewer", "reviewed_at",
  ],
  "exclusions.csv": [
    "exclusion_id", "entity_type", "entity_id", "person_id", "reason_code",
    "note", "source_id", "locator", "reviewer", "reviewed_at",
  ],
  "review_events.csv": [
    "review_id", "entity_type", "entity_id", "review_dimension", "decision",
    "reviewer", "reviewed_at", "note", "previous_revision", "new_revision",
  ],
  "release_manifests.csv": [
    "release_id", "version", "released_at", "schema_version", "method_version",
    "editorial_note", "checksum",
  ],
  "release_items.csv": [
    "release_id", "entity_type", "entity_id", "entity_revision",
  ],
};

async function readCsv(filePath) {
  try {
    return parse(await readFile(filePath, "utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function split(value) {
  return value ? value.split(";").map((item) => item.trim()).filter(Boolean) : [];
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function atomicCsv(filePath, columns, rows) {
  const body = [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${body}\n`, "utf8");
  await rename(temporary, filePath);
}

async function atomicJson(filePath, value) {
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, filePath);
}

function sourceRole(type) {
  if (type === "primary-text" || type === "digital-text-corpus") return "primary-or-text-corpus";
  if (type === "scholarly-encyclopedia" || type === "scholarly-book" || type === "scholarly-reference") return "scholarly-orientation";
  if (type === "institutional-profile") return "identity-and-bibliography";
  if (type === "research-database") return "identity-and-dating";
  return "method-only";
}

function targetDepth(importance) {
  return { core: "systematic", extended: "standard", context: "contextual" }[importance] ?? "screening";
}

function priority(importance) {
  return { core: "1", extended: "2", context: "3" }[importance] ?? "4";
}

function discoverySources(person) {
  const ids = [];
  const year = Number(person.active_year);
  const traditions = split(person.traditions);
  if (year <= 1900) ids.push("ctext-corpus", "ctext-api", "sinica-hanji");
  if (year >= 600 && year <= 1900) ids.push("cbdb", "cbdb-api");
  if (traditions.some((id) => id.includes("buddhism") || id === "chan-buddhism" || id === "tiantai-buddhism" || id === "huayan-buddhism" || id === "sanlun-buddhism" || id === "yogacara-buddhism")) ids.push("cbeta-corpus", "cbeta-api");
  return ids;
}

async function bootstrap() {
  await mkdir(researchDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });

  const [people, sources, statements, statementTexts, statementSources, relations, relationTexts] = await Promise.all([
    readCsv(path.join(dataDir, "people.csv")),
    readCsv(path.join(dataDir, "sources.csv")),
    readCsv(path.join(dataDir, "statements.csv")),
    readCsv(path.join(dataDir, "statement_translations.csv")),
    readCsv(path.join(dataDir, "statement_sources.csv")),
    readCsv(path.join(dataDir, "statement_relations.csv")),
    readCsv(path.join(dataDir, "relation_translations.csv")),
  ]);
  const sourceById = new Map(sources.map((row) => [row.id, row]));
  const claimsByPerson = new Map();
  for (const row of statements) claimsByPerson.set(row.person_id, (claimsByPerson.get(row.person_id) ?? 0) + 1);

  const existingPeople = new Map((await readCsv(path.join(researchDir, "people_status.csv"))).map((row) => [row.person_id, row]));
  const peopleStatus = people.map((person) => {
    const existing = existingPeople.get(person.id) ?? {};
    const sourceIds = [...new Set([...split(person.source_ids), ...discoverySources(person)])];
    const primaryCount = sourceIds.filter((id) => ["primary-text", "digital-text-corpus"].includes(sourceById.get(id)?.type)).length;
    const claimCount = claimsByPerson.get(person.id) ?? 0;
    return {
      person_id: person.id,
      inclusion_status: existing.inclusion_status || "included",
      inclusion_basis: existing.inclusion_basis || (person.importance === "context" ? "philosophical-context" : "philosophical-contribution"),
      priority: existing.priority || priority(person.importance),
      target_depth: existing.target_depth || targetDepth(person.importance),
      research_status: existing.research_status || (claimCount ? "published-claims-present" : "source-discovery"),
      source_discovery_status: sourceIds.length ? "orientation-sources-identified" : "not-started",
      primary_text_status: primaryCount ? "corpus-or-text-identified" : "locator-required",
      claim_extraction_status: claimCount ? "partial" : "not-started",
      published_claim_count: String(claimCount),
      identified_source_count: String(sourceIds.length),
      next_gate: claimCount ? "expand-system-coverage" : (primaryCount ? "extract-source-passages" : "identify-primary-text"),
      reviewer: existing.reviewer || "",
      last_audited_at: existing.last_audited_at || "",
    };
  });
  const claimDomainsByPerson = new Map();
  for (const claim of statements) {
    const domains = claimDomainsByPerson.get(claim.person_id) ?? [];
    domains.push(...split(claim.domain_ids));
    claimDomainsByPerson.set(claim.person_id, domains);
  }
  const existingCoverage = new Map((await readCsv(path.join(researchDir, "person_coverage.csv"))).map((row) => [`${row.person_id}:${row.coverage_dimension}`, row]));
  const personCoverage = people.flatMap((person) => {
    const claimDomains = claimDomainsByPerson.get(person.id) ?? [];
    const dimensions = [...new Set([...split(person.domains), "intellectual-development", "primary-works"])];
    return dimensions.map((dimension) => {
      const existing = existingCoverage.get(`${person.id}:${dimension}`) ?? {};
      const count = claimDomains.filter((id) => id === dimension).length;
      return {
        person_id: person.id,
        coverage_dimension: dimension,
        applicability: existing.applicability || "applicable",
        source_status: existing.source_status || "orientation-source-only",
        extraction_status: existing.extraction_status || (count ? "partial" : "not-started"),
        canonical_claim_count: String(count),
        saturation_status: existing.saturation_status || "not-assessed",
        gap_code: existing.gap_code || (count ? "coverage-expansion" : "claim-extraction"),
        reviewer: existing.reviewer || "",
        reviewed_at: existing.reviewed_at || "",
      };
    });
  });

  const existingPersonSources = new Map((await readCsv(path.join(researchDir, "person_sources.csv"))).map((row) => [`${row.person_id}:${row.source_id}`, row]));
  const personSources = people.flatMap((person) => [...new Set([...split(person.source_ids), ...discoverySources(person)])].map((sourceId) => {
    const existing = existingPersonSources.get(`${person.id}:${sourceId}`) ?? {};
    const isDeclaredSource = split(person.source_ids).includes(sourceId);
    return {
      person_id: person.id,
      source_id: sourceId,
      source_role: existing.source_role || sourceRole(sourceById.get(sourceId)?.type),
      evidence_scope: existing.evidence_scope || (isDeclaredSource ? "person-or-tradition" : "catalog-search"),
      locator: existing.locator || "",
      verification_status: existing.verification_status || (isDeclaredSource ? "identified" : "search-required"),
      reviewer: existing.reviewer || "",
      reviewed_at: existing.reviewed_at || "",
    };
  }));

  const existingClaims = new Map((await readCsv(path.join(researchDir, "claims.csv"))).map((row) => [row.claim_id, row]));
  const researchClaims = statements.map((row) => ({
    claim_id: row.id,
    person_id: row.person_id,
    content_type: row.content_type,
    active_year: row.active_year,
    sort_order: row.sort_order,
    is_introductory: row.is_introductory,
    domain_ids: row.domain_ids,
    research_status: existingClaims.get(row.id)?.research_status || "canonical",
    source_review_status: existingClaims.get(row.id)?.source_review_status || "source-reviewed",
    translation_review_status: existingClaims.get(row.id)?.translation_review_status || "bilingual-reviewed",
    dedup_review_status: existingClaims.get(row.id)?.dedup_review_status || "reviewed",
    publish_status: existingClaims.get(row.id)?.publish_status || "published",
    canonical_key: existingClaims.get(row.id)?.canonical_key || row.id,
    period_note: existingClaims.get(row.id)?.period_note || "",
    reviewer: row.reviewer,
    reviewed_at: row.reviewed_at,
  }));
  const publicClaimIds = new Set(researchClaims.map((row) => row.claim_id));
  researchClaims.push(...[...existingClaims.values()].filter((row) => !publicClaimIds.has(row.claim_id)));
  const existingClaimTexts = new Map((await readCsv(path.join(researchDir, "claim_texts.csv"))).map((row) => [`${row.claim_id}:${row.locale}`, row]));
  const researchClaimTexts = statementTexts.map((row) => ({
    claim_id: row.statement_id,
    locale: row.locale,
    text: row.text,
    explanation: row.explanation,
    tags: row.tags,
    translation_status: existingClaimTexts.get(`${row.statement_id}:${row.locale}`)?.translation_status || "reviewed",
    translator: existingClaimTexts.get(`${row.statement_id}:${row.locale}`)?.translator || "",
    reviewer: existingClaimTexts.get(`${row.statement_id}:${row.locale}`)?.reviewer || "phase1-editorial",
    reviewed_at: existingClaimTexts.get(`${row.statement_id}:${row.locale}`)?.reviewed_at || "2026-07-13",
  }));
  const publicClaimTextKeys = new Set(researchClaimTexts.map((row) => `${row.claim_id}:${row.locale}`));
  researchClaimTexts.push(...[...existingClaimTexts.entries()].filter(([key]) => !publicClaimTextKeys.has(key)).map(([, row]) => row));
  const existingClaimSources = new Map((await readCsv(path.join(researchDir, "claim_sources.csv"))).map((row) => [`${row.claim_id}:${row.source_id}:${row.locator}`, row]));
  const researchClaimSources = statementSources.map((row) => ({
    claim_id: row.statement_id,
    source_id: row.source_id,
    locator: row.locator,
    evidence_role: row.evidence_role,
    excerpt_id: existingClaimSources.get(`${row.statement_id}:${row.source_id}:${row.locator}`)?.excerpt_id || "",
    evidence_status: existingClaimSources.get(`${row.statement_id}:${row.source_id}:${row.locator}`)?.evidence_status || "locator-reviewed",
    reviewer: existingClaimSources.get(`${row.statement_id}:${row.source_id}:${row.locator}`)?.reviewer || "phase1-editorial",
    reviewed_at: existingClaimSources.get(`${row.statement_id}:${row.source_id}:${row.locator}`)?.reviewed_at || "2026-07-13",
  }));
  const publicClaimSourceKeys = new Set(researchClaimSources.map((row) => `${row.claim_id}:${row.source_id}:${row.locator}`));
  researchClaimSources.push(...[...existingClaimSources.entries()].filter(([key]) => !publicClaimSourceKeys.has(key)).map(([, row]) => row));
  const existingRelations = new Map((await readCsv(path.join(researchDir, "relations.csv"))).map((row) => [row.relation_id, row]));
  const researchRelations = relations.map((row) => ({
    relation_id: row.id,
    source_claim_id: row.source_statement_id,
    target_claim_id: row.target_statement_id,
    polarity: row.polarity,
    subtype: row.subtype,
    basis: row.basis,
    direction: row.direction,
    historical_influence: row.historical_influence,
    evidence_review_status: existingRelations.get(row.id)?.evidence_review_status || (row.evidence_source_ids ? "source-ids-recorded" : "editorial-only"),
    relation_review_status: existingRelations.get(row.id)?.relation_review_status || row.review_status,
    publish_status: existingRelations.get(row.id)?.publish_status || "published",
    reviewer: row.reviewer,
    reviewed_at: row.reviewed_at,
  }));
  const publicRelationIds = new Set(researchRelations.map((row) => row.relation_id));
  researchRelations.push(...[...existingRelations.values()].filter((row) => !publicRelationIds.has(row.relation_id)));
  const existingRelationTexts = new Map((await readCsv(path.join(researchDir, "relation_texts.csv"))).map((row) => [`${row.relation_id}:${row.locale}`, row]));
  const researchRelationTexts = relationTexts.map((row) => ({
    relation_id: row.relation_id,
    locale: row.locale,
    note: row.note,
    translation_status: existingRelationTexts.get(`${row.relation_id}:${row.locale}`)?.translation_status || "reviewed",
    reviewer: existingRelationTexts.get(`${row.relation_id}:${row.locale}`)?.reviewer || "phase1-editorial",
    reviewed_at: existingRelationTexts.get(`${row.relation_id}:${row.locale}`)?.reviewed_at || "2026-07-13",
  }));
  const publicRelationTextKeys = new Set(researchRelationTexts.map((row) => `${row.relation_id}:${row.locale}`));
  researchRelationTexts.push(...[...existingRelationTexts.entries()].filter(([key]) => !publicRelationTextKeys.has(key)).map(([, row]) => row));
  const existingRelationEvidence = new Map((await readCsv(path.join(researchDir, "relation_evidence.csv"))).map((row) => [`${row.relation_id}:${row.source_id}`, row]));
  const relationEvidence = relations.flatMap((row) => split(row.evidence_source_ids).map((sourceId) => ({
    relation_id: row.id,
    source_id: sourceId,
    locator: existingRelationEvidence.get(`${row.id}:${sourceId}`)?.locator || "",
    excerpt_id: existingRelationEvidence.get(`${row.id}:${sourceId}`)?.excerpt_id || "",
    evidence_role: existingRelationEvidence.get(`${row.id}:${sourceId}`)?.evidence_role || (row.basis === "editorial" ? "conceptual-comparison" : "scholarly-support"),
    evidence_status: existingRelationEvidence.get(`${row.id}:${sourceId}`)?.evidence_status || "source-identified-locator-pending",
    reviewer: existingRelationEvidence.get(`${row.id}:${sourceId}`)?.reviewer || "",
    reviewed_at: existingRelationEvidence.get(`${row.id}:${sourceId}`)?.reviewed_at || "",
  })));
  const publicRelationEvidenceKeys = new Set(relationEvidence.map((row) => `${row.relation_id}:${row.source_id}`));
  relationEvidence.push(...[...existingRelationEvidence.entries()].filter(([key]) => !publicRelationEvidenceKeys.has(key)).map(([, row]) => row));
  const existingReviews = await readCsv(path.join(researchDir, "review_events.csv"));
  const reviewEvents = existingReviews.length ? existingReviews : [
    ...researchClaims.map((row) => ({
      review_id: `migration-${row.claim_id}`,
      entity_type: "claim",
      entity_id: row.claim_id,
      review_dimension: "research-layer-migration",
      decision: "migrated-existing-reviewed-record",
      reviewer: row.reviewer,
      reviewed_at: "2026-07-14",
      note: "",
      previous_revision: "publication-schema-v4",
      new_revision: "research-method-v1",
    })),
    ...researchRelations.map((row) => ({
      review_id: `migration-${row.relation_id}`,
      entity_type: "relation",
      entity_id: row.relation_id,
      review_dimension: "research-layer-migration",
      decision: "migrated-existing-reviewed-record",
      reviewer: row.reviewer,
      reviewed_at: "2026-07-14",
      note: "",
      previous_revision: "publication-schema-v4",
      new_revision: "research-method-v1",
    })),
  ];
  const existingReleases = await readCsv(path.join(researchDir, "release_manifests.csv"));
  const releaseId = "phase1-2026-07-14";
  const checksum = createHash("sha256").update(JSON.stringify({ claims: researchClaims, relations: researchRelations })).digest("hex");
  const releaseManifests = existingReleases.length ? existingReleases : [{
    release_id: releaseId,
    version: "statement-focus-2026-07-14",
    released_at: "2026-07-14",
    schema_version: "4",
    method_version: "method-v1",
    editorial_note: "Migration baseline: 18 reviewed claims and 14 reviewed conceptual relations.",
    checksum,
  }];
  const existingReleaseItems = await readCsv(path.join(researchDir, "release_items.csv"));
  const releaseItems = existingReleaseItems.length ? existingReleaseItems : [
    ...researchClaims.map((row) => ({ release_id: releaseId, entity_type: "claim", entity_id: row.claim_id, entity_revision: "1" })),
    ...researchRelations.map((row) => ({ release_id: releaseId, entity_type: "relation", entity_id: row.relation_id, entity_revision: "1" })),
  ];

  const seeded = {
    "people_status.csv": peopleStatus,
    "person_sources.csv": personSources,
    "source_excerpts.csv": await readCsv(path.join(researchDir, "source_excerpts.csv")),
    "works.csv": await readCsv(path.join(researchDir, "works.csv")),
    "work_texts.csv": await readCsv(path.join(researchDir, "work_texts.csv")),
    "work_attributions.csv": await readCsv(path.join(researchDir, "work_attributions.csv")),
    "person_coverage.csv": personCoverage,
    "claims.csv": researchClaims,
    "claim_texts.csv": researchClaimTexts,
    "claim_sources.csv": researchClaimSources,
    "claim_decisions.csv": await readCsv(path.join(researchDir, "claim_decisions.csv")),
    "relations.csv": researchRelations,
    "relation_texts.csv": researchRelationTexts,
    "relation_evidence.csv": relationEvidence,
    "exclusions.csv": await readCsv(path.join(researchDir, "exclusions.csv")),
    "review_events.csv": reviewEvents,
    "release_manifests.csv": releaseManifests,
    "release_items.csv": releaseItems,
  };
  for (const [name, rows] of Object.entries(seeded)) await atomicCsv(path.join(researchDir, name), schemas[name], rows);
  console.log(`Research layer synchronized: ${peopleStatus.length} people, ${personSources.length} person-source links, ${researchClaims.length} published claims, ${researchRelations.length} published relations.`);
}

async function validate() {
  const errors = [];
  const warnings = [];
  const [people, sources, statuses, personSources, excerpts, works, workTexts, workAttributions, coverage, claims, texts, claimSources, decisions, relations, relationTexts, relationEvidence, exclusions, reviewEvents, releases, releaseItems] = await Promise.all([
    readCsv(path.join(dataDir, "people.csv")),
    readCsv(path.join(dataDir, "sources.csv")),
    readCsv(path.join(researchDir, "people_status.csv")),
    readCsv(path.join(researchDir, "person_sources.csv")),
    readCsv(path.join(researchDir, "source_excerpts.csv")),
    readCsv(path.join(researchDir, "works.csv")),
    readCsv(path.join(researchDir, "work_texts.csv")),
    readCsv(path.join(researchDir, "work_attributions.csv")),
    readCsv(path.join(researchDir, "person_coverage.csv")),
    readCsv(path.join(researchDir, "claims.csv")),
    readCsv(path.join(researchDir, "claim_texts.csv")),
    readCsv(path.join(researchDir, "claim_sources.csv")),
    readCsv(path.join(researchDir, "claim_decisions.csv")),
    readCsv(path.join(researchDir, "relations.csv")),
    readCsv(path.join(researchDir, "relation_texts.csv")),
    readCsv(path.join(researchDir, "relation_evidence.csv")),
    readCsv(path.join(researchDir, "exclusions.csv")),
    readCsv(path.join(researchDir, "review_events.csv")),
    readCsv(path.join(researchDir, "release_manifests.csv")),
    readCsv(path.join(researchDir, "release_items.csv")),
  ]);
  const personIds = new Set(people.map((row) => row.id));
  const sourceIds = new Set(sources.map((row) => row.id));
  const claimIds = new Set(claims.map((row) => row.claim_id));
  const excerptIds = new Set(excerpts.map((row) => row.excerpt_id));
  const relationIds = new Set(relations.map((row) => row.relation_id));
  const workIds = new Set(works.map((row) => row.work_id));
  const releaseIds = new Set(releases.map((row) => row.release_id));

  for (const personId of personIds) if (!statuses.some((row) => row.person_id === personId)) errors.push(`missing research status for ${personId}`);
  for (const row of statuses) {
    if (!personIds.has(row.person_id)) errors.push(`orphan research person ${row.person_id}`);
    if (!personSources.some((link) => link.person_id === row.person_id)) warnings.push(`no source candidate mapped for ${row.person_id}`);
  }
  for (const row of personSources) {
    if (!personIds.has(row.person_id)) errors.push(`unknown person on person-source link ${row.person_id}`);
    if (!sourceIds.has(row.source_id)) errors.push(`unknown source on person-source link ${row.source_id}`);
  }
  for (const row of excerpts) {
    if (!row.excerpt_id || !row.excerpt_text || !row.locator) errors.push(`incomplete source excerpt ${row.excerpt_id || "<missing-id>"}`);
    if (!personIds.has(row.person_id) || !sourceIds.has(row.source_id)) errors.push(`orphan source excerpt ${row.excerpt_id}`);
  }
  for (const row of workTexts) if (!workIds.has(row.work_id)) errors.push(`orphan work text ${row.work_id}:${row.locale}`);
  for (const row of workAttributions) {
    if (!workIds.has(row.work_id) || !personIds.has(row.person_id) || !sourceIds.has(row.source_id)) errors.push(`orphan work attribution ${row.attribution_id}`);
    if (row.excerpt_id && !excerptIds.has(row.excerpt_id)) errors.push(`unknown excerpt on work attribution ${row.attribution_id}`);
  }
  for (const personId of personIds) if (!coverage.some((row) => row.person_id === personId)) errors.push(`missing coverage dimensions for ${personId}`);
  for (const row of coverage) if (!personIds.has(row.person_id)) errors.push(`orphan coverage row ${row.person_id}:${row.coverage_dimension}`);
  for (const row of claims) {
    if (!personIds.has(row.person_id)) errors.push(`unknown person on claim ${row.claim_id}`);
    if (row.content_type !== "position") errors.push(`non-position claim ${row.claim_id}`);
    const localeSet = new Set(texts.filter((text) => text.claim_id === row.claim_id).map((text) => text.locale));
    if (!localeSet.has("zh-CN") || !localeSet.has("en")) errors.push(`missing bilingual text for ${row.claim_id}`);
    const evidence = claimSources.filter((link) => link.claim_id === row.claim_id);
    if (!evidence.length) errors.push(`claim has no source: ${row.claim_id}`);
    if (row.publish_status === "published") {
      if (row.research_status !== "canonical" || row.source_review_status !== "source-reviewed" || row.translation_review_status !== "bilingual-reviewed" || row.dedup_review_status !== "reviewed") errors.push(`published claim fails review gate: ${row.claim_id}`);
      if (evidence.some((link) => !link.locator || !["locator-reviewed", "excerpt-reviewed"].includes(link.evidence_status))) errors.push(`published claim lacks reviewed locator: ${row.claim_id}`);
    }
  }
  for (const row of texts) if (!claimIds.has(row.claim_id)) errors.push(`orphan claim text ${row.claim_id}:${row.locale}`);
  for (const row of claimSources) {
    if (!claimIds.has(row.claim_id) || !sourceIds.has(row.source_id)) errors.push(`orphan claim source ${row.claim_id}:${row.source_id}`);
    if (row.excerpt_id && !excerptIds.has(row.excerpt_id)) errors.push(`unknown excerpt ${row.excerpt_id} on ${row.claim_id}`);
  }
  for (const row of decisions) if (!claimIds.has(row.claim_id)) errors.push(`orphan claim decision ${row.decision_id}`);
  for (const row of relations) {
    if (!claimIds.has(row.source_claim_id) || !claimIds.has(row.target_claim_id)) errors.push(`orphan relation endpoint ${row.relation_id}`);
    if (row.publish_status === "published" && row.relation_review_status !== "reviewed") errors.push(`published relation fails review gate ${row.relation_id}`);
    if (!relationTexts.some((text) => text.relation_id === row.relation_id && text.locale === "zh-CN") || !relationTexts.some((text) => text.relation_id === row.relation_id && text.locale === "en")) errors.push(`missing bilingual relation note ${row.relation_id}`);
  }
  for (const row of relationEvidence) {
    if (!relationIds.has(row.relation_id) || !sourceIds.has(row.source_id)) errors.push(`orphan relation evidence ${row.relation_id}:${row.source_id}`);
  }
  for (const row of exclusions) if (row.person_id && !personIds.has(row.person_id)) errors.push(`unknown person on exclusion ${row.exclusion_id}`);
  for (const row of reviewEvents) if (!row.review_id || !row.entity_id || !row.review_dimension || !row.decision) errors.push(`incomplete review event ${row.review_id || "<missing-id>"}`);
  for (const row of releaseItems) if (!releaseIds.has(row.release_id)) errors.push(`orphan release item ${row.release_id}:${row.entity_id}`);

  const result = { checkedAt: new Date().toISOString(), errors, warnings };
  await mkdir(reportDir, { recursive: true });
  await atomicJson(path.join(reportDir, "research-validation.json"), result);
  if (warnings.length) for (const warning of warnings) console.warn(`WARN ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exit(1);
  }
  console.log(`Research validation passed with ${warnings.length} warning(s).`);
}

function publicRelationSubtype(row) {
  const allowed = new Set(["agreement", "expansion", "similarity", "disagreement", "refutation", "contrast"]);
  if (allowed.has(row.subtype)) return row.subtype;
  const value = `${row.subtype} ${row.basis}`.toLowerCase();
  if (row.polarity === "negative") return /refut|rebut|polemic|critique|objection/.test(value) ? "refutation" : "contrast";
  if (/agree|shared|parallel|similar|continuity|correspond/.test(value)) return "similarity";
  return "expansion";
}

function publicRelationBasis(value) {
  if (["primary", "historian", "editorial"].includes(value)) return value;
  const normalized = String(value).toLowerCase();
  if (/primary|text|author|same-work|genealogy|commentary/.test(normalized)) return "primary";
  if (/histor|scholar|biograph|teacher|disciple|debate/.test(normalized)) return "historian";
  return "editorial";
}

async function publish() {
  await validate();
  const [claims, texts, claimSources, relations, relationTexts, relationEvidence] = await Promise.all([
    readCsv(path.join(researchDir, "claims.csv")),
    readCsv(path.join(researchDir, "claim_texts.csv")),
    readCsv(path.join(researchDir, "claim_sources.csv")),
    readCsv(path.join(researchDir, "relations.csv")),
    readCsv(path.join(researchDir, "relation_texts.csv")),
    readCsv(path.join(researchDir, "relation_evidence.csv")),
  ]);
  const publishedClaims = claims.filter((row) => row.publish_status === "published");
  const publishedClaimIds = new Set(publishedClaims.map((row) => row.claim_id));
  const publishedRelations = relations.filter((row) => row.publish_status === "published" && publishedClaimIds.has(row.source_claim_id) && publishedClaimIds.has(row.target_claim_id));
  const publishedRelationIds = new Set(publishedRelations.map((row) => row.relation_id));

  await Promise.all([
    atomicCsv(path.join(dataDir, "statements.csv"), ["id", "person_id", "content_type", "active_year", "sort_order", "is_introductory", "domain_ids", "review_status", "reviewer", "reviewed_at"], publishedClaims.map((row) => ({
      id: row.claim_id, person_id: row.person_id, content_type: row.content_type, active_year: row.active_year,
      sort_order: row.sort_order, is_introductory: row.is_introductory, domain_ids: row.domain_ids,
      review_status: "source-reviewed", reviewer: row.reviewer, reviewed_at: row.reviewed_at,
    }))),
    atomicCsv(path.join(dataDir, "statement_translations.csv"), ["statement_id", "locale", "text", "explanation", "tags"], texts.filter((row) => publishedClaimIds.has(row.claim_id)).map((row) => ({ statement_id: row.claim_id, ...row }))),
    atomicCsv(path.join(dataDir, "statement_sources.csv"), ["statement_id", "source_id", "locator", "evidence_role"], claimSources.filter((row) => publishedClaimIds.has(row.claim_id)).map((row) => ({ statement_id: row.claim_id, ...row }))),
    atomicCsv(path.join(dataDir, "statement_relations.csv"), ["id", "source_statement_id", "target_statement_id", "polarity", "subtype", "basis", "direction", "historical_influence", "review_status", "reviewer", "reviewed_at", "evidence_source_ids"], publishedRelations.map((row) => ({
      id: row.relation_id, source_statement_id: row.source_claim_id, target_statement_id: row.target_claim_id,
      polarity: row.polarity, subtype: publicRelationSubtype(row), basis: publicRelationBasis(row.basis), direction: "undirected",
      historical_influence: row.historical_influence, review_status: "reviewed", reviewer: row.reviewer,
      reviewed_at: row.reviewed_at,
      evidence_source_ids: [...new Set(relationEvidence.filter((item) => item.relation_id === row.relation_id).map((item) => item.source_id))].join(";"),
    }))),
    atomicCsv(path.join(dataDir, "relation_translations.csv"), ["relation_id", "locale", "note"], relationTexts.filter((row) => publishedRelationIds.has(row.relation_id))),
  ]);
  console.log(`Published ${publishedClaims.length} claims and ${publishedRelations.length} relations to the application data layer.`);
}

async function report() {
  const [people, portraits, candidates, statuses, personSources, excerpts, works, coverage, claims, relations, exclusions, reviewEvents, releases] = await Promise.all([
    readCsv(path.join(dataDir, "people.csv")),
    readCsv(path.join(dataDir, "portraits.csv")),
    readCsv(path.join(researchDir, "person_candidates.csv")),
    readCsv(path.join(researchDir, "people_status.csv")),
    readCsv(path.join(researchDir, "person_sources.csv")),
    readCsv(path.join(researchDir, "source_excerpts.csv")),
    readCsv(path.join(researchDir, "works.csv")),
    readCsv(path.join(researchDir, "person_coverage.csv")),
    readCsv(path.join(researchDir, "claims.csv")),
    readCsv(path.join(researchDir, "relations.csv")),
    readCsv(path.join(researchDir, "exclusions.csv")),
    readCsv(path.join(researchDir, "review_events.csv")),
    readCsv(path.join(researchDir, "release_manifests.csv")),
  ]);
  const summary = {
    generatedAt: new Date().toISOString(),
    people: people.length,
    portraitCoverage: new Set(portraits.map((row) => row.person_id)).size,
    sourcedPortraits: portraits.filter((row) => row.kind === "sourced-image").length,
    discoveredPersonCandidates: candidates.length,
    newPersonCandidates: candidates.filter((row) => row.already_in_corpus === "false").length,
    peopleInResearchRegistry: statuses.length,
    peopleWithIdentifiedSources: new Set(personSources.map((row) => row.person_id)).size,
    personSourceLinks: personSources.length,
    sourceExcerpts: excerpts.length,
    works: works.length,
    coverageRows: coverage.length,
    canonicalClaims: claims.filter((row) => row.research_status === "canonical").length,
    publishedClaims: claims.filter((row) => row.publish_status === "published").length,
    peopleWithPublishedClaims: new Set(claims.filter((row) => row.publish_status === "published").map((row) => row.person_id)).size,
    publishedRelations: relations.filter((row) => row.publish_status === "published").length,
    exclusions: exclusions.length,
    reviewEvents: reviewEvents.length,
    releases: releases.length,
    pendingByGate: Object.fromEntries([...new Set(statuses.map((row) => row.next_gate))].sort().map((gate) => [gate, statuses.filter((row) => row.next_gate === gate).length])),
  };
  await mkdir(reportDir, { recursive: true });
  await atomicJson(path.join(reportDir, "research-coverage.json"), summary);
  console.log(JSON.stringify(summary, null, 2));
}

if (command === "bootstrap" || command === "sync") await bootstrap();
else if (command === "validate") await validate();
else if (command === "publish") await publish();
else if (command === "report") await report();
else {
  console.error(`Unknown command: ${command}. Use bootstrap, sync, validate, publish, or report.`);
  process.exit(1);
}
