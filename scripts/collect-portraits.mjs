import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parse } from "csv-parse/sync";

const root = process.cwd();
const dataDir = path.join(root, "data");
const outputDir = path.join(root, "public", "portraits");
const userAgent = "ChinesePhilosophyAtlas/0.1 (research portrait provenance pipeline)";
const execFileAsync = promisify(execFile);
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const split = (value) => value ? value.split(";").map((item) => item.trim()).filter(Boolean) : [];
const clean = (value = "") => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

async function powershellJson(url) {
  const safeUrl = url.replaceAll("'", "''");
  const command = `$ProgressPreference='SilentlyContinue'; (Invoke-RestMethod -Uri '${safeUrl}' -Headers @{'User-Agent'='ChinesePhilosophyAtlas/0.1'}) | ConvertTo-Json -Depth 100 -Compress`;
  const { stdout } = await execFileAsync("pwsh.exe", ["-NoProfile", "-Command", command], { maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function requestJson(url, attempts = 2) {
  if (process.platform === "win32") return powershellJson(url);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
      if (response.ok) return response.json();
      if (attempt === attempts) throw new Error(`${response.status} ${response.statusText}: ${url}`);
      if (response.status === 429) await delay(Number(response.headers.get("retry-after") ?? 5) * 1000);
    } catch {
      if (attempt === attempts) return powershellJson(url);
    }
    await delay(700 * attempt);
  }
}

function wikidataYear(entity, property) {
  const value = entity?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value?.time;
  if (!value) return null;
  const match = value.match(/^([+-]\d+)-/);
  return match ? Number(match[1]) : null;
}

function dateScore(person, entity) {
  const entityBirth = wikidataYear(entity, "P569");
  const entityDeath = wikidataYear(entity, "P570");
  const pairs = [[person.birthYear, entityBirth], [person.deathYear, entityDeath]].filter(([expected, actual]) => expected !== null && actual !== null);
  if (!pairs.length) return 0;
  return pairs.every(([expected, actual]) => Math.abs(expected - actual) <= 3) ? 35 : -60;
}

function candidateScore(person, candidate, entity) {
  const labels = new Set([person.nameZh, person.nameEn, ...person.aliasesZh, ...person.aliasesEn].map((value) => value.toLocaleLowerCase()));
  const label = (candidate.label ?? "").toLocaleLowerCase();
  const exact = labels.has(label);
  const description = `${candidate.description ?? ""} ${entity?.descriptions?.zh?.value ?? ""} ${entity?.descriptions?.en?.value ?? ""}`;
  const personLike = /思想|哲学|学者|政治|皇帝|君主|僧|禅|儒|道|作家|教育|histor|philosoph|scholar|politic|emperor|monk|writer/i.test(description);
  const image = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return (exact ? 55 : 0) + (personLike ? 20 : 0) + (image ? 15 : 0) + dateScore(person, entity);
}

async function entityBatch(ids) {
  if (!ids.length) return {};
  const params = new URLSearchParams({ action: "wbgetentities", ids: ids.join("|"), props: "claims|labels|descriptions", languages: "zh|en", format: "json", origin: "*" });
  const result = await requestJson(`https://www.wikidata.org/w/api.php?${params}`);
  return result.entities ?? {};
}

async function wikipediaEntityIds(people) {
  const ids = new Map();
  for (let index = 0; index < people.length; index += 40) {
    const batch = people.slice(index, index + 40);
    const params = new URLSearchParams({ action: "query", titles: batch.map((person) => person.nameZh).join("|"), redirects: "1", prop: "pageprops", format: "json", origin: "*" });
    const payload = await requestJson(`https://zh.wikipedia.org/w/api.php?${params}`);
    const titleMap = new Map(batch.map((person) => [person.nameZh, person.nameZh]));
    for (const item of payload.query?.normalized ?? []) titleMap.set(item.from, item.to);
    for (const item of payload.query?.redirects ?? []) {
      for (const [original, current] of titleMap) if (current === item.from) titleMap.set(original, item.to);
    }
    const pages = new Map(Object.values(payload.query?.pages ?? {}).map((page) => [page.title, page]));
    for (const person of batch) {
      const page = pages.get(titleMap.get(person.nameZh));
      if (page?.pageprops?.wikibase_item) ids.set(person.id, page.pageprops.wikibase_item);
    }
  }
  return ids;
}

async function commonsMetadata(titles) {
  const result = new Map();
  for (let index = 0; index < titles.length; index += 40) {
    const batch = titles.slice(index, index + 40);
    const params = new URLSearchParams({ action: "query", titles: batch.map((title) => `File:${title}`).join("|"), prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "256", format: "json", origin: "*" });
    const payload = await requestJson(`https://commons.wikimedia.org/w/api.php?${params}`);
    for (const page of Object.values(payload.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      result.set(page.title.replace(/^File:/, ""), { ...info, pageUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}` });
    }
  }
  return result;
}

async function downloadPortrait(personId, url) {
  if (process.platform === "win32") {
    const extension = /\.png(?:\/|$)/i.test(url) ? "png" : /\.svg(?:\/|$)/i.test(url) ? "svg" : "jpg";
    const filename = `${personId}.${extension}`;
    const destination = path.join(outputDir, filename).replaceAll("'", "''");
    const safeUrl = url.replaceAll("'", "''");
    const command = `$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '${safeUrl}' -Headers @{'User-Agent'='ChinesePhilosophyAtlas/0.1'} -OutFile '${destination}'`;
    await execFileAsync("pwsh.exe", ["-NoProfile", "-Command", command], { maxBuffer: 1024 * 1024 });
    return `/portraits/${filename}`;
  }
  try {
    const response = await fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const type = response.headers.get("content-type") ?? "";
    const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("svg") ? "svg" : "jpg";
    const filename = `${personId}.${extension}`;
    await writeFile(path.join(outputDir, filename), Buffer.from(await response.arrayBuffer()));
    return `/portraits/${filename}`;
  } catch {
    const extension = /\.png(?:\/|$)/i.test(url) ? "png" : /\.svg(?:\/|$)/i.test(url) ? "svg" : "jpg";
    const filename = `${personId}.${extension}`;
    const destination = path.join(outputDir, filename).replaceAll("'", "''");
    const safeUrl = url.replaceAll("'", "''");
    const command = `$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '${safeUrl}' -Headers @{'User-Agent'='ChinesePhilosophyAtlas/0.1'} -OutFile '${destination}'`;
    await execFileAsync("pwsh.exe", ["-NoProfile", "-Command", command], { maxBuffer: 1024 * 1024 });
    return `/portraits/${filename}`;
  }
}

const peopleRows = parse(await readFile(path.join(dataDir, "people.csv"), "utf8"), { columns: true, skip_empty_lines: true, trim: true, bom: true });
const nameRows = parse(await readFile(path.join(dataDir, "people_i18n.csv"), "utf8"), { columns: true, skip_empty_lines: true, trim: true, bom: true });
const names = new Map(nameRows.map((row) => [row.id, row]));
const people = peopleRows.map((row) => {
  const name = names.get(row.id);
  return {
    id: row.id,
    birthYear: row.birth_year ? Number(row.birth_year) : null,
    deathYear: row.death_year ? Number(row.death_year) : null,
    nameZh: name.name_zh,
    nameEn: name.name_en,
    aliasesZh: split(name.aliases_zh),
    aliasesEn: split(name.aliases_en),
  };
});

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "_neutral.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="#ddd8cc"/><circle cx="64" cy="47" r="24" fill="#77756f"/><path d="M22 119c4-29 19-43 42-43s38 14 42 43" fill="#77756f"/></svg>\n`, "utf8");

const wikipediaIds = await wikipediaEntityIds(people);
console.log(`Exact Wikipedia/Wikidata entity matches: ${wikipediaIds.size}/${people.length}`);
const candidateIds = [...new Set(wikipediaIds.values())];
const entities = {};
for (let index = 0; index < candidateIds.length; index += 45) Object.assign(entities, await entityBatch(candidateIds.slice(index, index + 45)));

const matches = people.map((person) => {
  const id = wikipediaIds.get(person.id);
  const entity = id ? entities[id] : null;
  const candidate = id ? { id, label: entity?.labels?.zh?.value ?? person.nameZh, description: entity?.descriptions?.zh?.value ?? "" } : null;
  const best = candidate ? { candidate, entity, score: candidateScore(person, candidate, entity) + 20 } : null;
  const filename = best?.entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return { person, best, filename: best?.score >= 70 ? filename : null };
});

const metadata = await commonsMetadata([...new Set(matches.map((match) => match.filename).filter(Boolean))]);
const rows = [];
for (const [index, match] of matches.entries()) {
  const info = match.filename ? metadata.get(match.filename) : null;
  let localPath = "/portraits/_neutral.svg";
  let kind = "neutral-placeholder";
  let status = "needs-portrait-review";
  let note = match.best ? `Best automated Wikidata score: ${match.best.score}` : "No Wikidata candidate";
  if (info?.thumburl) {
    try {
      localPath = await downloadPortrait(match.person.id, info.thumburl);
      kind = "sourced-image";
      status = match.best.score >= 105 ? "high-confidence-auto" : "candidate-auto";
    } catch (error) {
      note = `${note}; download failed: ${error.message}`;
    }
  }
  const extension = info?.extmetadata ?? {};
  rows.push({
    person_id: match.person.id,
    kind,
    local_path: localPath,
    wikidata_id: match.best?.candidate?.id ?? "",
    source_url: info?.pageUrl ?? (match.best ? `https://www.wikidata.org/wiki/${match.best.candidate.id}` : ""),
    file_title: match.filename ?? "",
    author: clean(extension.Artist?.value),
    license: clean(extension.LicenseShortName?.value),
    license_url: extension.LicenseUrl?.value ?? "",
    review_status: status,
    match_method: match.best ? "wikidata-label-date-description" : "none",
    notes: note,
  });
  if ((index + 1) % 20 === 0) console.log(`Portrait downloads ${index + 1}/${people.length}`);
}

const headers = ["person_id", "kind", "local_path", "wikidata_id", "source_url", "file_title", "author", "license", "license_url", "review_status", "match_method", "notes"];
const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
await writeFile(path.join(dataDir, "portraits.csv"), `${csv}\n`, "utf8");
const sourced = rows.filter((row) => row.kind === "sourced-image").length;
console.log(`Portrait index complete: ${sourced} sourced images, ${rows.length - sourced} explicit neutral placeholders, ${rows.length} people covered.`);
