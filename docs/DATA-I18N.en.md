# Data and Internationalization Specification

## 1. Core tables

The production database separates stable entities from translations so adding a language never requires adding language-specific columns to core tables.

The current canonical CSV sources map to runtime Schema v4 as follows:

| Table | Purpose |
|---|---|
| `people.csv` | Stable person IDs, dates, status, and non-linguistic fields; people are system containers, not relation nodes |
| `people_i18n.csv` | Current Chinese/English names and aliases; the database form will use one row per locale |
| `statements.csv` | Stable philosophical-position IDs, person, order, domains, and review state; the only public type is `position` |
| `statement_translations.csv` | One row per locale for statement text, explanation, and tags |
| `statement_sources.csv` | Statement-source links, exact locators, and evidence role |
| `statement_relations.csv` | Two statement endpoints, polarity, subtype, basis, direction, and influence state |
| `relation_translations.csv` | One row per locale for relation explanations |
| `taxonomies.csv` | Periods, traditions, domains, and bilingual labels |
| `sources.csv` | Research sources, links, and bilingual citation notes |

Every production translation record contains at least `locale`, `value`, `status`, `translator_id`, `reviewer_id`, `source_locale`, and `updated_at`. Statement and relation CSVs already use long-form locale rows. The current wide people translation table is a Phase 1 compatibility format and must be migrated before adding a third language.

## 2. Language traceability

Visible language must never be hidden in component conditionals. It comes from one of three explicit paths:

1. UI dictionary keys such as `toolbar.zoomIn`.
2. Entity translation records such as `statement_translations`.
3. Explicitly non-translated proper names or primary-source text.

Every UI region carries a `data-i18n-scope` marker. `src/i18n/scopes.json` maps each region to its keys so maintainers can locate the screen area responsible for a missing translation.

Run:

```bash
npm run i18n:check
```

It checks locale key parity, unknown or extra keys, unscoped keys, and keys assigned to multiple regions.

## 3. API locale contract

Public APIs accept `lang`:

```text
GET /api/v1/timeline?lang=zh-CN
GET /api/v1/timeline?lang=en
```

Response metadata reports requested locale, resolved locale, locale fallback, field-level fallbacks, data status, and schema version. In Schema v4, `people` are system headings and `statements` (also returned as `nodes`) contain reviewed `position` records only. Every relation endpoint is a position ID; research-progress tables never enter the public API. Silent fallback is forbidden.

## 4. Adding a locale

1. Register the locale in `src/i18n/config.ts`.
2. Add a complete UI dictionary.
3. Create database translation jobs.
4. Run `npm run i18n:check`.
5. Inspect every `data-i18n-scope` region.
6. Review API `fieldFallbacks`.
7. Publish only after native-language review.

## 5. Spreadsheet-driven updates

An import workbook should mirror the nine canonical CSVs above. Run `npm run data:research-queue` to update the internal person-research queue, then `npm run data:build` to validate and generate the public corpus. The queue is not a statement table and can never become page nodes. Coordinates, curves, filters, indexes, and zoom LOD are recalculated automatically.
