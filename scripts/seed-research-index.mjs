import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

const root = process.cwd();
const dataDir = path.join(root, "data");

async function readCsv(name) {
  return parse(await readFile(path.join(dataDir, name), "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
}

function split(value) {
  return value ? value.split(";").map((item) => item.trim()).filter(Boolean) : [];
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function writeCsv(name, columns, rows) {
  const body = [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");
  await writeFile(path.join(dataDir, name), `${body}\n`, "utf8");
}

const [people, peopleI18n, rawStatements, rawTranslations, rawSources] = await Promise.all([
  readCsv("people.csv"),
  readCsv("people_i18n.csv"),
  readCsv("statements.csv"),
  readCsv("statement_translations.csv"),
  readCsv("statement_sources.csv"),
]);

const names = new Map(peopleI18n.map((row) => [row.id, row]));
const generatedIds = new Set(rawStatements.filter((row) => row.reviewer === "coverage-pipeline").map((row) => row.id));
const statements = rawStatements
  .filter((row) => !generatedIds.has(row.id))
  .map((row) => ({ ...row, content_type: row.content_type || "position" }));
const translations = rawTranslations.filter((row) => !generatedIds.has(row.statement_id));
const sources = rawSources.filter((row) => !generatedIds.has(row.statement_id));
const peopleWithPositions = new Set(statements.filter((row) => row.content_type === "position").map((row) => row.person_id));

const statementOrder = new Map(statements.map((row, index) => [row.id, index]));
translations.sort((a, b) => (statementOrder.get(a.statement_id) ?? 0) - (statementOrder.get(b.statement_id) ?? 0) || (a.locale === "zh-CN" ? -1 : 1));
sources.sort((a, b) => (statementOrder.get(a.statement_id) ?? 0) - (statementOrder.get(b.statement_id) ?? 0));
const contentCountByPerson = new Map();
for (const statement of statements) contentCountByPerson.set(statement.person_id, (contentCountByPerson.get(statement.person_id) ?? 0) + 1);
const researchQueue = [...people]
  .sort((a, b) => ({ core: 1, extended: 2, context: 3 }[a.importance] ?? 4) - ({ core: 1, extended: 2, context: 3 }[b.importance] ?? 4) || Number(a.active_year) - Number(b.active_year))
  .map((person) => {
    const name = names.get(person.id);
    const hasPosition = peopleWithPositions.has(person.id);
    return {
      priority: { core: "1", extended: "2", context: "3" }[person.importance] ?? "4",
      person_id: person.id,
      name_zh: name?.name_zh ?? "",
      name_en: name?.name_en ?? "",
      period: person.period,
      importance: person.importance,
      coverage_status: hasPosition ? "reviewed-position-present" : "position-research-pending",
      content_count: String(contentCountByPerson.get(person.id) ?? 0),
      person_source_id: split(person.source_ids)[0] ?? "",
      primary_source_status: hasPosition ? "locator-recorded-for-current-position" : "pending",
      specialist_source_status: "person-level-source-listed",
      relation_review_status: hasPosition ? "position-relation-review-open" : "blocked-until-position-review",
      next_action: hasPosition ? "expand-position-system-and-audit-relations" : "locate-primary-text-and-extract-first-position",
    };
  });

await mkdir(path.join(dataDir, "reports"), { recursive: true });
await Promise.all([
  writeCsv("statements.csv", ["id", "person_id", "content_type", "active_year", "sort_order", "is_introductory", "domain_ids", "review_status", "reviewer", "reviewed_at"], statements),
  writeCsv("statement_translations.csv", ["statement_id", "locale", "text", "explanation", "tags"], translations),
  writeCsv("statement_sources.csv", ["statement_id", "source_id", "locator", "evidence_role"], sources),
  writeCsv("reports/research-queue.csv", ["priority", "person_id", "name_zh", "name_en", "period", "importance", "coverage_status", "content_count", "person_source_id", "primary_source_status", "specialist_source_status", "relation_review_status", "next_action"], researchQueue),
]);

console.log(`Removed ${generatedIds.size} non-position timeline entries; retained ${statements.filter((row) => row.content_type === "position").length} reviewed positions and rebuilt the 155-person research queue.`);
