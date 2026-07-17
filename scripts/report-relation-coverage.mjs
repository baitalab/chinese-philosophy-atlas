import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

const root = process.cwd();
const readCsv = async (file) => parse(await readFile(path.join(root, file), "utf8"), { columns: true, skip_empty_lines: true, trim: true, bom: true });
const [people, claims, relations] = await Promise.all([
  readCsv("data/people.csv"),
  readCsv("data/research/claims.csv"),
  readCsv("data/research/relations.csv"),
]);

const personById = new Map(people.map((row) => [row.id, row]));
const claimById = new Map(claims.map((row) => [row.claim_id, row]));
const periods = [...new Set(people.map((row) => row.period))];
const published = relations.filter((row) => row.publish_status === "published");
const countBy = (items, key) => Object.fromEntries([...new Set(items.map(key))].sort().map((value) => [value, items.filter((item) => key(item) === value).length]));
const periodOfClaim = (claimId) => personById.get(claimById.get(claimId)?.person_id)?.period ?? "unknown";
const periodPairs = countBy(published, (row) => `${periodOfClaim(row.source_claim_id)} -> ${periodOfClaim(row.target_claim_id)}`);
const relationsByPeriod = Object.fromEntries(periods.map((period) => [period, published.filter((row) => periodOfClaim(row.source_claim_id) === period || periodOfClaim(row.target_claim_id) === period).length]));
const peopleWithRelations = new Set(published.flatMap((row) => [claimById.get(row.source_claim_id)?.person_id, claimById.get(row.target_claim_id)?.person_id]).filter(Boolean));
const peopleWithoutRelationsByPeriod = Object.fromEntries(periods.map((period) => [period, people.filter((person) => person.period === period && !peopleWithRelations.has(person.id)).map((person) => person.id)]));
const degreeByPerson = new Map(people.map((person) => [person.id, 0]));
for (const relation of published) for (const personId of new Set([claimById.get(relation.source_claim_id)?.person_id, claimById.get(relation.target_claim_id)?.person_id].filter(Boolean))) degreeByPerson.set(personId, (degreeByPerson.get(personId) ?? 0) + 1);
const sortedDegrees = [...degreeByPerson.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const report = {
  generatedAt: new Date().toISOString(),
  people: people.length,
  claims: claims.filter((row) => row.publish_status === "published").length,
  publishedRelations: published.length,
  peopleWithRelations: peopleWithRelations.size,
  peopleWithoutRelations: people.length - peopleWithRelations.size,
  polarity: countBy(published, (row) => row.polarity),
  influenceLevel: countBy(published, (row) => row.historical_influence),
  relationsByPeriod,
  peopleWithoutRelationsByPeriod,
  degree: {
    minimum: Math.min(...degreeByPerson.values()),
    median: [...degreeByPerson.values()].sort((a, b) => a - b)[Math.floor(degreeByPerson.size / 2)],
    maximum: sortedDegrees[0]?.[1] ?? 0,
    highest: sortedDegrees.slice(0, 12).map(([personId, count]) => ({ personId, count })),
  },
  periodPairs,
};

await mkdir(path.join(root, "data/reports"), { recursive: true });
await writeFile(path.join(root, "data/reports/relation-coverage.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
