# Chinese Thought Atlas Development Specification

Version: 0.1  
Date: 2026-07-13  
Status: Phase 1 statement-focus interaction complete; position expansion in progress (Schema v4)

## 1. Product objective

Build a statement-centered temporal relationship network spanning traditional antiquity through contemporary Chinese philosophy. Time organizes people and statements; typed relations connect positions across periods; data updates through spreadsheets, the editorial system, or APIs must automatically regenerate the visualization without hand-drawing pages.

The interaction model takes inspiration from History of Philosophy: a full-screen canvas, diagonal timeline, dense statements, positive and negative relationship curves, person/statement focus, combined filters, and URL-addressable state. Code, identity, assets, and research data remain original to this project.

## 2. Three-phase roadmap

### Phase 1: research baseline and timeline display system

Phase 1 combines the interaction core with an auditable baseline people register. Inclusion follows `RESEARCH-METHOD.en.md`; fame or an isolated quotation is never a substitute for evidence.

Required capabilities:

1. A continuous content stream descending from upper left to lower right; birth year controls ordering and date display, never proportional distance.
2. No physical time spine or year ticks; dates, dynasties, and periods appear through labels, filters, and details.
3. People as temporal/system containers; their statements are the actual knowledge nodes.
4. Positive and negative semantic relationship curves.
5. A separate direction field for evidenced influence, inheritance, or transmission; color must never imply direction.
6. Zoom, pan, fit-to-screen, and viewport restoration.
7. Person focus, statement focus, first-degree neighborhoods, and further expansion.
8. Filters for people, topics, periods, relation types, and introductory statements.
9. URL persistence for view, filters, and focus.
10. Equivalent Chinese and English UI and API behavior.
11. CSV-driven bilingual people, statements, relations, taxonomy, and sources with automatic layout regeneration.
12. Taxonomy co-occurrence may generate private research candidates but never a public edge; every published edge joins two reviewed statements.
13. Explicit distinction between attested, traditional, textual, and legendary personae.

Rendering evolution:

- Validate content slots, curves, and interaction with SVG.
- Move to Canvas/WebGL beyond roughly 1,000 nodes or 5,000 edges.
- Run large layouts, filtering, and spatial indexing in Web Workers.
- Use continuous level of detail: headings and statement copy always exist, compress into line texture in overview, and become readable through zoom.

Phase 1 acceptance criteria:

- Performance reports for 100, 1,000, and 10,000-node fixtures.
- Birth year determines order and accumulated person/statement slots determine position; hand-authored coordinates are never authoritative.
- Combined filters restore correctly from the URL.
- Keyboard, screen-reader, and reduced-motion support.
- Both locales pass `npm run i18n:check`.

### Phase 2: statement/relation expansion and refinement

The people register and statement-relation kernel are delivered in Phase 1. Phase 2 expands statements from primary texts or reliable scholarship and refines similarity, expansion, refutation, contrast, influence, and transmission item by item. Relations are undirected conceptual links by default; historical influence or transmission is recorded separately only when evidence supports it.

“All people” means an open and continuously expanding register, not a claim of final completeness. Public records move through candidate, screened, sourced, relation-reviewed, and published states.

Research sequence:

1. Establish controlled vocabularies for periods, dynasties, schools, institutions, and regions.
2. Generate the first candidate register from authoritative general histories, period histories, intellectual histories, and dictionaries.
3. Add classicists, religious thinkers, political thinkers, scientific thinkers, literary thinkers, and overseas Chinese scholars.
4. Record authoritative names, aliases, dates, active periods, roles, works, and sources.
5. Extract statements from primary texts or reliable scholarship; never fabricate statements from biographies.
6. Record evidence, editor, confidence, and historical-influence status for every relation.
7. Track Chinese and English completion, translator, reviewer, and update time independently.

Source priority:

1. Critical primary editions, collected works, and institutional digital collections.
2. Scholarly histories and monographs from established publishers.
3. Peer-reviewed articles and university or research-institute profiles.
4. Encyclopedias and open data for discovery only, not as sole evidence for important relations.

### Phase 3: maintenance and editorial administration

The administration system must provide:

- XLSX/CSV import, validation, and change previews.
- CRUD for people, statements, topics, relations, and sources.
- Side-by-side Chinese/English editing and translation status.
- Draft, review, approved, returned, and withdrawn workflows.
- Relation-evidence review and conflict detection.
- Bulk tagging, period mapping, and alias merging.
- Release versions, audit logs, snapshots, and rollback.
- Cache invalidation and automatic graph refresh after publication.
- Machine-readable exports and citable research releases.

## 3. System architecture

```text
Browser interaction layer
  ├─ Timeline Canvas/WebGL
  ├─ HTML filters and detail panels
  └─ URL state
        ↓
Next.js App Router
  ├─ Server Components: initial data and SEO
  ├─ Client Components: canvas interaction
  ├─ Route Handlers: public APIs, import, export
  └─ Server Functions: editorial mutations
        ↓
Domain and data-access layer
  ├─ people (containers), statements (nodes), relations (statement edges), topics, sources
  ├─ locale resolution and missing-language reports
  └─ graph aggregation, filtering, viewport queries
        ↓
PostgreSQL + object storage + optional Redis
```

Database and external-service clients must be initialized lazily. Public reads and editorial writes remain separate, and proxy logic is never the sole authorization boundary.

## 4. Ubuntu deployment

Production uses a multi-stage Docker image and Next.js standalone output:

```text
Internet → nginx/Caddy → Next.js container → PostgreSQL
                                  └──────→ Redis (at scale)
```

Requirements include Ubuntu LTS, Docker Engine, Compose v2, TLS and rate limiting at the reverse proxy, non-root containers, `/api/health` checks, coordinated cache/deployment IDs for multiple instances, daily database backups, and automatic snapshots before imports.

## 5. Current delivery

- Complete legacy archive.
- Fresh Next.js 16.2.10 project.
- A 155-person baseline with 167 source-located bilingual positions covering all 155 people, 14 seed position relations, and 98 bilingual taxonomy terms.
- A six-person research seed for Confucius, Laozi, Mozi, Mencius, Zhuangzi, and Xunzi, with primary-text locators for every statement.
- A birth-ranked upper-left-to-lower-right content stream where people are system headings, content advances in equal rows, and years do not control adjacent distance.
- Positive/negative adaptive-curvature statement arcs, cursor-anchored zoom, axis-free point-stream LOD, strictly spaced statement rows, and collision-aware labels.
- Search, person focus, statement focus, sources, combined filters, dark mode, and URL state.
- `/zh-CN` and `/en` routes.
- Locale-aware timeline API.
- Translation-key, UI-scope, and missing-language checks.
- Ubuntu Docker and reverse-proxy foundation.

The public timeline accepts only item-edited `position` records. The current 18 positions cover six people; collection progress for the other 149 people exists only in the internal research queue and is never rendered as a position. Person selection shows all of that person's positions plus strict first-degree neighbors; position selection shows only that position and its strict first-degree neighbors. Neither opens a detail sidebar.
