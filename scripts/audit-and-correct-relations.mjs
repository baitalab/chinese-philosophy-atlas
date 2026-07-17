import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

const root = process.cwd();
const dataDir = path.join(root, "data");
const researchDir = path.join(dataDir, "research");
const reportDir = path.join(dataDir, "reports");
const today = "2026-07-17";
const reviewer = "method-audit-2026-07-17";

const csv = async (file) => parse(await readFile(file, "utf8"), { columns: true, skip_empty_lines: true, trim: true, bom: true });
const quote = (value) => /[",\r\n]/.test(String(value ?? "")) ? `"${String(value ?? "").replaceAll('"', '""')}"` : String(value ?? "");
const writeCsv = async (file, rows, headers = Object.keys(rows[0] ?? {})) => writeFile(file, `${headers.join(",")}\n${rows.map((row) => headers.map((header) => quote(row[header])).join(",")).join("\n")}\n`, "utf8");

const statements = await csv(path.join(dataDir, "statements.csv"));
const publicRelations = await csv(path.join(dataDir, "statement_relations.csv"));
const researchRelations = await csv(path.join(researchDir, "relations.csv"));
const relationEvidence = await csv(path.join(researchDir, "relation_evidence.csv"));
const reviewEvents = await csv(path.join(researchDir, "review_events.csv"));
const personByStatement = new Map(statements.map((statement) => [statement.id, statement.person_id]));
const evidenceByRelation = new Map();
for (const evidence of relationEvidence) evidenceByRelation.set(evidence.relation_id, [...(evidenceByRelation.get(evidence.relation_id) ?? []), evidence]);

const downgraded = [];
for (const relation of publicRelations) {
  const crossPerson = personByStatement.get(relation.source_statement_id) !== personByStatement.get(relation.target_statement_id);
  const evidence = evidenceByRelation.get(relation.id) ?? [];
  const lacksLocatedInfluenceEvidence = evidence.length === 0 || evidence.every((item) => !item.locator && !item.excerpt_id);
  if (crossPerson && relation.historical_influence === "explicit" && lacksLocatedInfluenceEvidence) {
    relation.historical_influence = "conceptual-only";
    downgraded.push(relation.id);
  }
}
for (const relation of researchRelations) if (downgraded.includes(relation.relation_id)) relation.historical_influence = "conceptual-only";

const evidenceSeen = new Set();
const deduplicatedEvidence = relationEvidence.filter((item) => {
  const key = [item.relation_id, item.source_id, item.locator, item.excerpt_id, item.evidence_role].join("|");
  if (evidenceSeen.has(key)) return false;
  evidenceSeen.add(key);
  return true;
});

const existingReviewIds = new Set(reviewEvents.map((event) => event.review_id));
for (const relationId of downgraded) {
  const reviewId = `audit-historical-influence-${relationId}`;
  if (existingReviewIds.has(reviewId)) continue;
  reviewEvents.push({
    review_id: reviewId,
    entity_type: "relation",
    entity_id: relationId,
    review_dimension: "historical-influence",
    decision: "downgrade",
    reviewer,
    reviewed_at: today,
    note: "Cross-person relation lacked a located excerpt or direct transmission evidence; retained as a conceptual relation only.",
    previous_revision: "explicit",
    new_revision: "conceptual-only",
  });
}

await Promise.all([
  writeCsv(path.join(dataDir, "statement_relations.csv"), publicRelations),
  writeCsv(path.join(researchDir, "relations.csv"), researchRelations),
  writeCsv(path.join(researchDir, "relation_evidence.csv"), deduplicatedEvidence),
  writeCsv(path.join(researchDir, "review_events.csv"), reviewEvents),
]);
await mkdir(reportDir, { recursive: true });
const report = {
  auditedAt: today,
  relationsAudited: publicRelations.length,
  historicalInfluenceDowngrades: downgraded,
  duplicateEvidenceRowsRemoved: relationEvidence.length - deduplicatedEvidence.length,
  remainingExplicitCrossPersonRelations: publicRelations.filter((relation) => personByStatement.get(relation.source_statement_id) !== personByStatement.get(relation.target_statement_id) && relation.historical_influence === "explicit").map((relation) => relation.id),
  method: "Cross-person explicit influence requires a located excerpt or direct transmission evidence; otherwise the visible edge remains conceptual-only.",
};
await writeFile(path.join(reportDir, "relation-quality-audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Relation audit complete: ${downgraded.length} unsupported explicit-influence labels downgraded; ${report.duplicateEvidenceRowsRemoved} duplicate evidence row removed.`);
