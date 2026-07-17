import corpus from "./generated/corpus.json";
import type { Locale } from "@/i18n/config";

const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type RelationKind = "positive" | "negative";
export type ContentType = "position";

type RawTaxonomy = (typeof corpus.taxonomy)[number];
type RawPerson = (typeof corpus.people)[number];

export type TimelineTerm = {
  id: string;
  label: string;
  color: string;
};

export type TimelineSource = {
  id: string;
  title: string;
  type: string;
  url: string;
  citation: string;
};

export type TimelinePerson = {
  id: string;
  year: number;
  birthYear: number | null;
  deathYear: number | null;
  name: string;
  aliases: string[];
  dateLabel: string;
  dating: string;
  historicity: string;
  period: TimelineTerm;
  traditions: TimelineTerm[];
  domains: TimelineTerm[];
  importance: string;
  reviewStatus: string;
  portrait: {
    kind: string;
    path: string;
    sourceUrl: string;
    author: string;
    license: string;
    licenseUrl: string;
    reviewStatus: string;
  };
  sources: TimelineSource[];
  statementIds: string[];
};

export type TimelineRelation = {
  id: string;
  source: string;
  target: string;
  kind: RelationKind;
  subtype: string;
  basis: string;
  direction: "undirected";
  historicalInfluence: "conceptual-only" | "probable" | "explicit";
  note: string;
  evidenceSources: TimelineSource[];
  status: string;
};

export type TimelineStatement = {
  id: string;
  personId: string;
  contentType: ContentType;
  activeYear: number;
  order: number;
  introductory: boolean;
  text: string;
  explanation: string;
  tags: string[];
  domains: TimelineTerm[];
  reviewStatus: string;
  reviewer: string;
  reviewedAt: string;
  sources: Array<TimelineSource & { locator: string; evidenceRole: string }>;
};

function yearLabel(year: number, locale: Locale) {
  if (locale === "zh-CN") return year < 0 ? `前${Math.abs(year)}` : `${year}`;
  return year < 0 ? `${Math.abs(year)} BCE` : `${year}`;
}

function dateLabel(person: RawPerson, locale: Locale) {
  const { birthYear, deathYear, activeYear, dating } = person;
  if (birthYear !== null && deathYear !== null) return `${yearLabel(birthYear, locale)}—${yearLabel(deathYear, locale)}`;
  if (birthYear !== null) return `${yearLabel(birthYear, locale)}—`;
  if (deathYear !== null) return locale === "zh-CN" ? `卒于${yearLabel(deathYear, locale)}年` : `d. ${yearLabel(deathYear, locale)}`;
  const prefix = dating === "traditional"
    ? (locale === "zh-CN" ? "传统纪年约" : "traditional date c. ")
    : (locale === "zh-CN" ? "约活动于" : "fl. c. ");
  return `${prefix}${yearLabel(activeYear, locale)}${locale === "zh-CN" ? "年" : ""}`;
}

function localizeTerm(term: RawTaxonomy, locale: Locale): TimelineTerm {
  return { id: term.id, label: term.labels[locale], color: term.color };
}

export function getResearchTimeline(locale: Locale) {
  const taxonomy = new Map(corpus.taxonomy.map((term) => [`${term.kind}:${term.id}`, term]));
  const sourceMap = new Map(corpus.sources.map((source) => [source.id, source]));
  const statements: TimelineStatement[] = corpus.statements.map((statement) => ({
    id: statement.id,
    personId: statement.personId,
    contentType: statement.contentType as ContentType,
    activeYear: statement.activeYear,
    order: statement.order,
    introductory: statement.introductory,
    text: statement.translations[locale].text,
    explanation: statement.translations[locale].explanation,
    tags: statement.translations[locale].tags,
    domains: statement.domainIds.map((id) => localizeTerm(taxonomy.get(`domain:${id}`)!, locale)),
    reviewStatus: statement.reviewStatus,
    reviewer: statement.reviewer,
    reviewedAt: statement.reviewedAt,
    sources: statement.sources.map((reference) => {
      const source = sourceMap.get(reference.sourceId)!;
      return { id: source.id, title: source.title, type: source.type, url: source.url, citation: source.citations[locale], locator: reference.locator, evidenceRole: reference.evidenceRole };
    }),
  }));
  const statementIdsByPerson = new Map<string, string[]>();
  for (const statement of statements) statementIdsByPerson.set(statement.personId, [...(statementIdsByPerson.get(statement.personId) ?? []), statement.id]);

  const people: TimelinePerson[] = corpus.people.map((person) => ({
    id: person.id,
    year: person.activeYear,
    birthYear: person.birthYear,
    deathYear: person.deathYear,
    name: person.names[locale],
    aliases: person.aliases[locale],
    dateLabel: dateLabel(person, locale),
    dating: person.dating,
    historicity: person.historicity,
    period: localizeTerm(taxonomy.get(`period:${person.period}`)!, locale),
    traditions: person.traditions.map((id) => localizeTerm(taxonomy.get(`tradition:${id}`)!, locale)),
    domains: person.domains.map((id) => localizeTerm(taxonomy.get(`domain:${id}`)!, locale)),
    importance: person.importance,
    reviewStatus: person.reviewStatus,
    portrait: {
      kind: person.portrait.kind,
      path: `${publicBasePath}${person.portrait.path}`,
      sourceUrl: person.portrait.sourceUrl,
      author: person.portrait.author,
      license: person.portrait.license,
      licenseUrl: person.portrait.licenseUrl,
      reviewStatus: person.portrait.reviewStatus,
    },
    sources: person.sourceIds.map((id) => {
      const source = sourceMap.get(id)!;
      return { id, title: source.title, type: source.type, url: source.url, citation: source.citations[locale] };
    }),
    statementIds: statementIdsByPerson.get(person.id) ?? [],
  }));

  const relations: TimelineRelation[] = corpus.relations.map((relation) => ({
    id: relation.id,
    source: relation.sourceStatementId,
    target: relation.targetStatementId,
    kind: relation.polarity as RelationKind,
    subtype: relation.subtype,
    basis: relation.basis,
    direction: relation.direction as "undirected",
    historicalInfluence: relation.historicalInfluence as TimelineRelation["historicalInfluence"],
    note: relation.notes[locale],
    evidenceSources: relation.evidenceSourceIds.map((id) => {
      const source = sourceMap.get(id)!;
      return { id, title: source.title, type: source.type, url: source.url, citation: source.citations[locale] };
    }),
    status: relation.reviewStatus,
  }));

  const periods = corpus.taxonomy.filter((term) => term.kind === "period").map((term) => localizeTerm(term, locale));
  const traditions = corpus.taxonomy.filter((term) => term.kind === "tradition").map((term) => localizeTerm(term, locale));
  const domains = corpus.taxonomy.filter((term) => term.kind === "domain").map((term) => localizeTerm(term, locale));

  return {
    people,
    statements,
    nodes: statements,
    relations,
    periods,
    traditions,
    domains,
    coverage: corpus.coverage,
    dataVersion: corpus.dataVersion,
    fallbackFields: [] as string[],
  };
}
