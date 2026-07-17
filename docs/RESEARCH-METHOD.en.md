# Phase 1 Research Method and Inclusion Standard

Version: `phase1-2026-07-13`  
Scope: people register, statements, statement relations, sources, and bilingual research traceability

## 1. Unit of research

The unit of knowledge is a locatable and citable philosophical statement. A person is the temporal and systematic container for multiple statements. Phase 1 now includes the people register, the display system, and a small item-reviewed statement/relation seed; no unreviewed relation may be published.

The reference project *History of Philosophy* publicly describes a method of extracting sourced sentences that express positions or arguments; it is not a collection of famous quotations. This project adopts that research scale while using independent data, taxonomies, and code.

## 2. Inclusion

A candidate must satisfy at least one condition and have a reliable research entry point:

1. Writings, recorded teachings, or a teaching lineage produced positions repeatedly discussed in histories of Chinese philosophy.
2. Political, religious, literary, historiographical, scientific, or translation work made an arguable contribution to a Chinese philosophical problem.
3. A non-attested figure functions as a stable textual or intellectual persona in canonical philosophical discussion.
4. A contemporary figure developed a recognizable system, argument, or interpretive framework rather than merely holding an academic post.

Three inclusion tiers are used: `core`, `extended`, and `context`.

## 3. Exclusion

The register excludes people included only because of a popular quotation, celebrity, office, moral reputation, routine scholarship without a distinct contribution, unresolved identity ambiguity, or absence of reliable research entry points.

Exclusion is not a judgment of personal worth. It means only that the current evidence does not meet this atlas's recordable-philosophy threshold.

## 4. Historicity

`attested`, `traditional`, `textual-persona`, and `legendary` are separate record types. Traditional dates for figures such as Fuxi are displayed as traditional chronology and must not be presented as archaeological fact.

## 5. Review states

- `screened`: passes the inclusion screen and has research entry points; metadata remains open to precision review.
- `source-reviewed`: an editor has checked Phase 1 inclusion and basic classification against listed scholarly sources. This does not imply review of every attributed claim.

Every statement and relation has its own review state and never inherits a person's status. A statement records its person, order, primary location, and bilingual summary/explanation. A relation records two statements, polarity, subtype, basis, historical-influence status, evidence, editor, and review date.

Research progress is tracked separately in `data/reports/research-queue.csv`. A queue row is never a statement and can never appear as a page node or relation endpoint.

## 6. Coverage

The people baseline contains 155 people across nine periods. It records 138 attested people, 12 traditional or legendary personae, and five textual personae. Seventy-one records are source-reviewed and 84 are screened.

Schema v4 currently contains 18 item-reviewed positions for six people. The 14 reviewed position relations comprise ten positive and four negative links. The remaining people stay visible in the chronological register while their position research remains in the internal queue.

This is an auditable public baseline, not a claim that Chinese philosophy has been exhausted. Additions, removals, and tier changes require versioned records.

## 7. Statement-relation rules

- A person is never an edge endpoint; both endpoints must be distinct statement IDs.
- `positive` means similarity or expansion; `negative` means contrast or refutation. Color does not imply temporal direction.
- Relations are `undirected` by default: conceptual comparability does not prove reading, transmission, or influence.
- `historical_influence` is separate and may be marked probable or explicit only with evidence.
- `basis` distinguishes explicit textual response, historian-supported interpretation, and editorial comparison.
- Shared traditions, domains, or tags may create private candidates but can never publish an edge automatically.
- Person focus shows all statements of that person and their first-degree neighbors; statement focus shows one statement and its first-degree neighbors.

## 8. Maintenance

Editors update `data/people.csv`, `data/people_i18n.csv`, `data/statements.csv`, `data/statement_translations.csv`, `data/statement_sources.csv`, `data/statement_relations.csv`, `data/relation_translations.csv`, `data/taxonomies.csv`, and `data/sources.csv`. Running `npm run data:build` validates foreign keys, bilingual fields, dates, locators, evidence, and controlled vocabulary, then regenerates the site. Coordinates and relation arcs are derived automatically; no page is hand-drawn.
