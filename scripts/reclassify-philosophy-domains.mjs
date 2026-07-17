import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";

const categories = [
  ["tiandao-metaphysics", "天道与形上", "Heaven, cosmos & metaphysics", "#4038a0"],
  ["mind-human-nature", "心性与人性", "Mind & human nature", "#c238b4"],
  ["knowledge-method", "知识与方法", "Knowledge & method", "#b82fb7"],
  ["names-language", "名辩与语言", "Names, logic & language", "#8ecfe5"],
  ["ethics-cultivation", "伦理与修养", "Ethics & self-cultivation", "#f0b447"],
  ["politics-governance", "政治与治理", "Politics & governance", "#da5733"],
  ["ritual-law", "礼法与制度", "Ritual, law & institutions", "#9b5a38"],
  ["religion-transcendence", "宗教与超越", "Religion & transcendence", "#5aa8a6"],
  ["nature-technology", "自然与技艺", "Nature, science & technology", "#5376d8"],
  ["history-culture", "历史与文化", "History & culture", "#92969a"],
  ["education-hermeneutics", "教育与诠释", "Education & interpretation", "#8f6bad"],
  ["aesthetics-art", "艺术与审美", "Art & aesthetics", "#782bd1"],
  ["society-world", "社会与天下", "Society & world order", "#687b92"],
];

const domainMap = new Map(Object.entries({
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
  economics: "society-world", gender: "society-world", international: "society-world",
  utopianism: "society-world", "world-order": "society-world",
}));
for (const [id] of categories) domainMap.set(id, id);

const periods = [
  ["ancient-preqin", "上古与先秦", "Antiquity & pre-Qin", "#b56f4f"],
  ["qin-han", "秦汉", "Qin–Han", "#d39a3c"],
  ["wei-jin-tang", "魏晋隋唐", "Wei–Jin–Sui–Tang", "#73966f"],
  ["song-yuan-ming-qing", "宋元明清", "Song–Yuan–Ming–Qing", "#4f8790"],
  ["late-qing-republic", "晚清民国", "Late Qing & Republic", "#7466ae"],
  ["contemporary-china", "二十世纪至今", "20th century–present", "#aa596f"],
];

const periodMap = new Map(Object.entries({
  "legendary-antiquity": "ancient-preqin", classical: "ancient-preqin",
  "early-imperial": "qin-han", medieval: "wei-jin-tang",
  "song-yuan": "song-yuan-ming-qing", "ming-qing": "song-yuan-ming-qing",
  "late-qing-republic": "late-qing-republic",
  "prc-modern": "contemporary-china", contemporary: "contemporary-china",
}));
for (const [id] of periods) periodMap.set(id, id);

const categoryOrder = categories.map(([id]) => id);
const parseCsv = async (file) => parse(await fs.readFile(file, "utf8"), { columns: true, skip_empty_lines: true });
const escapeCsv = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const writeCsv = async (file, rows, headers) => {
  const lines = [headers.join(","), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))];
  await fs.writeFile(file, `${lines.join("\n")}\n`, "utf8");
};
const remapDomains = (value) => {
  const mapped = new Set(String(value ?? "").split(";").filter(Boolean).map((id) => domainMap.get(id)).filter(Boolean));
  return categoryOrder.filter((id) => mapped.has(id));
};

const statements = await parseCsv("data/statements.csv");
for (const statement of statements) {
  const mapped = remapDomains(statement.domain_ids);
  if (!mapped.length || mapped.length > 4) throw new Error(`${statement.id} mapped to ${mapped.length} categories`);
  statement.domain_ids = mapped.join(";");
}

const researchClaims = await parseCsv("data/research/claims.csv");
for (const claim of researchClaims) {
  const mapped = remapDomains(claim.domain_ids);
  if (!mapped.length || mapped.length > 4) throw new Error(`${claim.claim_id} mapped to ${mapped.length} categories`);
  claim.domain_ids = mapped.join(";");
}

const domainsByPerson = new Map();
for (const statement of statements) {
  const ids = domainsByPerson.get(statement.person_id) ?? new Set();
  statement.domain_ids.split(";").forEach((id) => ids.add(id));
  domainsByPerson.set(statement.person_id, ids);
}

const people = await parseCsv("data/people.csv");
for (const person of people) {
  const period = periodMap.get(person.period);
  if (!period) throw new Error(`No period mapping for ${person.id}: ${person.period}`);
  person.period = period;
  const ids = domainsByPerson.get(person.id);
  if (!ids?.size) throw new Error(`No published statement categories for ${person.id}`);
  person.domains = categoryOrder.filter((id) => ids.has(id)).join(";");
}

const taxonomy = await parseCsv("data/taxonomies.csv");
const retained = taxonomy.filter((row) => row.kind !== "period" && row.kind !== "domain");
const rebuiltTaxonomy = [
  ...periods.map(([id, label_zh, label_en, color]) => ({ kind: "period", id, label_zh, label_en, color })),
  ...retained,
  ...categories.map(([id, label_zh, label_en, color]) => ({ kind: "domain", id, label_zh, label_en, color })),
];

await writeCsv("data/statements.csv", statements, Object.keys(statements[0]));
await writeCsv("data/research/claims.csv", researchClaims, Object.keys(researchClaims[0]));
await writeCsv("data/people.csv", people, Object.keys(people[0]));
await writeCsv("data/taxonomies.csv", rebuiltTaxonomy, ["kind", "id", "label_zh", "label_en", "color"]);

const cardinality = statements.reduce((counts, statement) => {
  const count = statement.domain_ids.split(";").length;
  counts[count] = (counts[count] ?? 0) + 1;
  return counts;
}, {});
console.log(JSON.stringify({ categories: categories.length, periods: periods.length, statements: statements.length, cardinality }, null, 2));
