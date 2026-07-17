# Reference-project relation model and local adaptation

Date: 2026-07-13

## 1. The reference project's fundamental unit

The author's public methodology and live interface show that the primary view is a sentence/statement timeline, not a people graph:

- A person is a group container made of a heading, portrait, and dates.
- Each person may have multiple statements in argumentative order; one dot cannot stand for the whole system.
- Every statement is an independent node with topics, keywords, sources, and multiple possible relations.
- Green relations indicate agreement, similarity, or development; red relations indicate disagreement, contrast, or refutation.
- Primary-view relations are generally undirected conceptual relations and do not automatically prove lineage, reading, transmission, or historical influence.
- The people graph and people timeline are secondary aggregates derived from statement relations, not authoritative source data.

Person focus shows all statements by that person plus their first-degree neighbors. Statement focus shows one statement and its first-degree neighbors. Overview does not delete headings or statement copy: canvas scaling compresses them into short lines and colour texture, and zoom restores readable statements, tags, and sources. The Basics filter is a manually curated selection of a few central statements per person, not an automated popularity score.

## 1.1 Measured reference layout

A read-only browser instrumentation pass against the live canvas on 2026-07-14 produced reproducible layout measurements:

- The primary graph uses two full-screen Canvas elements and no visible SVG time axis.
- The people index contains 189 entries. Headings are sorted by birth year, but adjacent distance is not proportional to elapsed years.
- Every heading lies on one diagonal content coordinate. The fitted base heading slot is about `53.33` world units and every statement adds about `20.06` world units, with roughly `0.39` world-unit error.
- Therefore the next heading follows `next = current + personSlot + statementCount × statementSlot`.
- Years determine ordering and display; statement count determines occupied content space. This preserves chronology without creating huge gaps for historically quiet periods.

The implementation runs at a strict 45° from upper left to lower right: a person advances `54 × (1, 1)` and a position advances `40 × (1, 1)`. No physical axis or year ticks are rendered. Fit view compresses headings and position copy into point-and-line texture. Focus keeps only strict first-degree relations and reflows the visible people and positions into compact slots.

## 2. Local adaptation

```text
Person (system/temporal container)
  └─ Statement 1 (node) ──── positive / negative ──── Statement X
  └─ Statement 2 (node) ──── positive / negative ──── Statement Y
  └─ Statement 3 (node)
```

Public edges may only come from item-reviewed rows in `statement_relations.csv`. Shared traditions, domains, or tags may produce private candidates only. `polarity` describes the conceptual relation; `historical_influence` independently records historical influence.

## 3. Independent implementation

This review found no official source repository or open licence authorizing reuse of the reference project's code, data, portraits, or visual assets. This project adopts only publicly described information architecture and interaction principles, using independent code, Chinese-philosophy research data, taxonomies, and visual implementation.

## 4. Public references

- Project method and relation semantics: https://www.denizcemonduygu.com/philo/
- Basics statement filter: https://www.denizcemonduygu.com/philo/basics-filter-for-the-uninitiated/
- Version 6 views and interaction: https://www.denizcemonduygu.com/philo/version-6-launched-new-visualization-methods-new-filters-new-interface/
- Aggregated people graph: https://www.denizcemonduygu.com/philo/new-force-directed-graph-with-philosophers-as-nodes/
