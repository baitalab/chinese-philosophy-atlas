import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const corpus = JSON.parse(await readFile("src/data/generated/corpus.json", "utf8"));
const counts = [100, 1000, 10000];
const runs = 40;

function makeFixture(count) {
  return Array.from({ length: count }, (_, index) => {
    const base = corpus.people[index % corpus.people.length];
    return { ...base, id: `${base.id}-${index}`, activeYear: -3000 + ((index * 7919) % 5027) };
  });
}

function work(people) {
  const buckets = new Map();
  const points = people.map((person) => {
    const ratio = (person.activeYear + 3000) / 5026;
    const bucket = Math.round(ratio * 180);
    const lane = buckets.get(bucket) ?? 0;
    buckets.set(bucket, lane + 1);
    return { x: 125 + ratio * 1350 + lane * 4.47, y: 790 - ratio * 675 + lane * 8.94, person };
  });
  return points.filter(({ person }) => person.domains.includes("ethics") || person.period === "classical").length;
}

const results = counts.map((count) => {
  const fixture = makeFixture(count);
  const samples = [];
  for (let run = 0; run < runs; run += 1) {
    const start = performance.now();
    work(fixture);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return { nodes: count, runs, medianMs: Number(samples[Math.floor(runs / 2)].toFixed(3)), p95Ms: Number(samples[Math.floor(runs * .95)].toFixed(3)) };
});

const report = { benchmark: "timeline-position-and-filter", runtime: process.version, platform: `${process.platform}-${process.arch}`, results };
await writeFile("data/reports/timeline-benchmark.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(results.map((row) => `${row.nodes}: median ${row.medianMs} ms, p95 ${row.p95Ms} ms`).join("\n"));
