"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Locale } from "@/i18n/config";
import { alternateLocale } from "@/i18n/config";
import type { Messages } from "@/i18n";
import { getResearchTimeline, type RelationKind, type TimelinePerson, type TimelineStatement, type TimelineTerm } from "@/data/research-corpus";
import { clientPointInSvg, MAX_ZOOM, MIN_ZOOM, relationCurve, statementPoint, zoomAt, type TimelineView } from "./timeline-geometry";
import { DetailPanel } from "./timeline-detail-panel";

const WIDTH = 1600;
const HEIGHT = 900;
const START = { x: 125, y: 100 };
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const FIT_ADVANCE = Math.min(WIDTH - 320, HEIGHT - 160);
const PERSON_SLOT = 54;
const STATEMENT_SLOT = 40;
// Text stays in world coordinates and scales with the graph. Below the true
// pixel-scale threshold the interactive nodes are replaced by one static SVG
// snapshot, avoiding both illegible glyph work and hundreds of DOM nodes.
const STATIC_OVERVIEW_ZOOM = 0.04;

type TimelineData = ReturnType<typeof getResearchTimeline>;
type PointPerson = TimelinePerson & { x: number; y: number; color: string; rank: number; sortYear: number; layoutStatementCount: number };
type PointStatement = TimelineStatement & { x: number; y: number; color: string; person: PointPerson; layoutOrder: number };

function circleSubpath(x: number, y: number, radius: number) {
  return `M ${(x - radius).toFixed(2)} ${y.toFixed(2)} a ${radius} ${radius} 0 1 0 ${(radius * 2).toFixed(2)} 0 a ${radius} ${radius} 0 1 0 ${(-radius * 2).toFixed(2)} 0`;
}

function rectSubpath(x: number, y: number, width: number, height: number) {
  return `M ${x.toFixed(2)} ${y.toFixed(2)} h ${width.toFixed(2)} v ${height.toFixed(2)} h ${(-width).toFixed(2)} Z`;
}

function compactWidth(text: string, unit: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Array.from(text).length * unit));
}

function icon(name: "plus" | "minus" | "fit" | "theme" | "legend" | "filter" | "back" | "search" | "info" | "close") {
  const paths = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <path d="M5 12h14" />,
    fit: <><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /><path d="M9 9h6v6H9z" /></>,
    theme: <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z" />,
    legend: <><circle cx="7" cy="7" r="2" /><circle cx="7" cy="12" r="2" /><circle cx="7" cy="17" r="2" /><path d="M12 7h7M12 12h7M12 17h7" /></>,
    filter: <><path d="M4 6h7M15 6h5M4 12h2M10 12h10M4 18h10M18 18h2" /><circle cx="13" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function CategoryDot({ domains, radius }: { domains: TimelineTerm[]; radius: number }) {
  const categories = domains.slice(0, 4);
  if (categories.length <= 1) {
    return <circle className="statement-dot" r={radius} style={{ fill: categories[0]?.color ?? "var(--muted)" }} data-category-count={categories.length || 1} />;
  }
  const step = (Math.PI * 2) / categories.length;
  return <g className="statement-dot" data-category-count={categories.length}>
    {categories.map((category, index) => {
      const start = -Math.PI / 2 + index * step;
      const end = start + step;
      const startPoint = { x: Math.cos(start) * radius, y: Math.sin(start) * radius };
      const endPoint = { x: Math.cos(end) * radius, y: Math.sin(end) * radius };
      const path = `M 0 0 L ${startPoint.x.toFixed(3)} ${startPoint.y.toFixed(3)} A ${radius} ${radius} 0 0 1 ${endPoint.x.toFixed(3)} ${endPoint.y.toFixed(3)} Z`;
      return <path key={category.id} className="statement-dot-segment" d={path} style={{ fill: category.color }} />;
    })}
    <circle className="statement-dot-outline" r={radius} />
  </g>;
}

function buildPersonPoints(people: TimelinePerson[], statementCountByPerson?: Map<string, number>) {
  const ordered = [...people].sort((a, b) => {
    const aYear = a.birthYear ?? a.year;
    const bYear = b.birthYear ?? b.year;
    return aYear - bYear || a.year - b.year || a.id.localeCompare(b.id);
  });
  let cursor = 0;
  return ordered.map<PointPerson>((person, rank) => {
    const layoutStatementCount = statementCountByPerson?.get(person.id) ?? person.statementIds.length;
    const point = { x: START.x + cursor, y: START.y + cursor };
    cursor += PERSON_SLOT + layoutStatementCount * STATEMENT_SLOT;
    return { ...person, ...point, rank, sortYear: person.birthYear ?? person.year, layoutStatementCount, color: person.period.color };
  });
}

function fitViewForPeople(people: TimelinePerson[], statementCountByPerson?: Map<string, number>): TimelineView {
  const totalAdvance = people.reduce((total, person) => total + PERSON_SLOT + (statementCountByPerson?.get(person.id) ?? person.statementIds.length) * STATEMENT_SLOT, 0);
  const zoom = Math.max(MIN_ZOOM, Math.min(1, FIT_ADVANCE / Math.max(1, totalAdvance)));
  const midpoint = { x: START.x + totalAdvance / 2, y: START.y + totalAdvance / 2 };
  return {
    zoom,
    pan: {
      x: (CENTER.x - midpoint.x) * zoom,
      y: (CENTER.y - midpoint.y) * zoom,
    },
  };
}

function buildStatementPoints(statements: TimelineStatement[], people: Map<string, PointPerson>) {
  const localOrder = new Map<string, number>();
  return statements.flatMap<PointStatement>((statement) => {
    const person = people.get(statement.personId);
    if (!person) return [];
    const layoutOrder = (localOrder.get(statement.personId) ?? 0) + 1;
    localOrder.set(statement.personId, layoutOrder);
    const point = statementPoint(person, layoutOrder);
    return [{
      ...statement,
      person,
      x: point.x,
      y: point.y,
      color: statement.domains[0]?.color ?? person.color,
      layoutOrder,
    }];
  });
}

export function TimelineShell({ locale, messages, timeline }: { locale: Locale; messages: Messages; timeline: TimelineData }) {
  const [view, setView] = useState<TimelineView>(() => fitViewForPeople(timeline.people));
  const { zoom, pan } = view;
  const readView = useEffectEvent(() => view);
  const [dark, setDark] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [statementFocus, setStatementFocus] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [periods, setPeriods] = useState<Set<string>>(new Set());
  const [domains, setDomains] = useState<Set<string>>(new Set());
  const [relationKinds, setRelationKinds] = useState<Set<RelationKind>>(new Set(["positive", "negative"]));
  const [showLegend, setShowLegend] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showDetail, setShowDetail] = useState<"statement" | "person" | "relation" | null>(null);
  const [relationFocus, setRelationFocus] = useState<string | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const [hoverPersonId, setHoverPersonId] = useState<string | null>(null);
  const [hoverStatementId, setHoverStatementId] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const wheelFrame = useRef<number | null>(null);
  const pendingWheel = useRef<{ anchor: { x: number; y: number }; factor: number } | null>(null);
  const infoDialog = useRef<HTMLElement | null>(null);
  const canvas = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 720px)");
    const syncFilterVisibility = () => setShowFilters(!mobile.matches);
    syncFilterVisibility();
    mobile.addEventListener("change", syncFilterVisibility);
    return () => mobile.removeEventListener("change", syncFilterVisibility);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      setFocus(params.get("person"));
      setStatementFocus(params.get("statement"));
      setQuery(params.get("q") ?? "");
      setPeriods(new Set(params.get("period")?.split(",").filter(Boolean) ?? []));
      setDomains(new Set(params.get("domain")?.split(",").filter(Boolean) ?? []));
      setUrlReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (focus) params.set("person", focus);
    if (statementFocus) params.set("statement", statementFocus);
    if (query) params.set("q", query);
    if (periods.size) params.set("period", [...periods].join(","));
    if (domains.size) params.set("domain", [...domains].join(","));
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }, [focus, statementFocus, query, periods, domains, urlReady]);

  useEffect(() => {
    if (!showInfo) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setShowInfo(false); };
    const frame = window.requestAnimationFrame(() => infoDialog.current?.focus());
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("keydown", handleKeyDown); };
  }, [showInfo]);

  useEffect(() => {
    const svg = canvas.current;
    if (!svg) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const anchor = clientPointInSvg(svg, event.clientX, event.clientY);
      const factor = Math.exp(-event.deltaY * 0.0014);
      pendingWheel.current = pendingWheel.current
        ? { anchor, factor: pendingWheel.current.factor * factor }
        : { anchor, factor };
      if (wheelFrame.current !== null) return;
      wheelFrame.current = window.requestAnimationFrame(() => {
        const pending = pendingWheel.current;
        pendingWheel.current = null;
        wheelFrame.current = null;
        if (pending) setView((current) => zoomAt(current, pending.anchor, current.zoom * pending.factor, CENTER));
      });
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      svg.removeEventListener("wheel", handleWheel);
      if (wheelFrame.current !== null) window.cancelAnimationFrame(wheelFrame.current);
      wheelFrame.current = null;
      pendingWheel.current = null;
    };
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const peopleById = useMemo(() => new Map(timeline.people.map((person) => [person.id, person])), [timeline.people]);
  const statementsById = useMemo(() => new Map(timeline.statements.map((statement) => [statement.id, statement])), [timeline.statements]);

  const personPasses = useMemo(() => new Set(timeline.people.filter((person) =>
    !periods.size || periods.has(person.period.id)
  ).map((person) => person.id)), [timeline.people, periods]);

  const queryPeopleIds = useMemo(() => new Set(timeline.people.filter((person) => {
    if (!normalizedQuery) return false;
    return [person.name, ...person.aliases].join(" ").toLocaleLowerCase(locale).includes(normalizedQuery);
  }).map((person) => person.id)), [timeline.people, normalizedQuery, locale]);

  const filteredStatements = useMemo(() => timeline.statements.filter((statement) => {
    const person = peopleById.get(statement.personId);
    const searchable = [statement.text, statement.explanation, ...statement.tags, person?.name ?? "", ...(person?.aliases ?? [])].join(" ").toLocaleLowerCase(locale);
    return personPasses.has(statement.personId)
      && (!domains.size || statement.domains.some((term) => domains.has(term.id)))
      && (!normalizedQuery || searchable.includes(normalizedQuery));
  }), [timeline.statements, peopleById, personPasses, domains, normalizedQuery, locale]);
  const filteredStatementIds = useMemo(() => new Set(filteredStatements.map((statement) => statement.id)), [filteredStatements]);
  const activeRelations = useMemo(() => timeline.relations.filter((relation) => relationKinds.has(relation.kind)), [timeline.relations, relationKinds]);
  const filteredRelations = useMemo(() => activeRelations.filter((relation) => filteredStatementIds.has(relation.source) && filteredStatementIds.has(relation.target)), [activeRelations, filteredStatementIds]);

  // Person focus scope: the full set of statement IDs visible when only the person is focused
  // (the person's own statements + all one-degree neighbors across the whole corpus).
  const personFocusScopeIds = useMemo(() => {
    if (!focus) return null;
    const ownIds = new Set(timeline.statements.filter((s) => s.personId === focus).map((s) => s.id));
    const scopeIds = new Set(ownIds);
    for (const rel of activeRelations) {
      if (ownIds.has(rel.source)) scopeIds.add(rel.target);
      if (ownIds.has(rel.target)) scopeIds.add(rel.source);
    }
    return scopeIds;
  }, [focus, timeline.statements, activeRelations]);

  // Focus seed IDs: the starting set for the one-degree graph query.
  // - Person focus only → seed = all of that person's statements
  // - Statement focus (with or without person context) → seed = the one statement
  const focusSeedIds = useMemo(() => {
    if (statementFocus && statementsById.has(statementFocus)) return new Set([statementFocus]);
    if (focus) return new Set(timeline.statements.filter((s) => s.personId === focus).map((s) => s.id));
    return null;
  }, [focus, statementFocus, timeline.statements, statementsById]);

  const visibleRelations = useMemo(() => {
    if (!focusSeedIds) return filteredRelations;
    let candidates = activeRelations;
    // When there is a person focus scope AND a statement focus,
    // restrict the relation pool to the person-scope so we don't show
    // connections outside the person context.
    if (personFocusScopeIds && statementFocus) {
      candidates = candidates.filter((r) => personFocusScopeIds.has(r.source) && personFocusScopeIds.has(r.target));
    }
    return candidates.filter((r) => focusSeedIds.has(r.source) || focusSeedIds.has(r.target));
  }, [focusSeedIds, activeRelations, filteredRelations, personFocusScopeIds, statementFocus]);
  const visibleStatementIds = useMemo(() => {
    if (!focusSeedIds) return filteredStatementIds;
    const ids = new Set(focusSeedIds);
    for (const relation of visibleRelations) { ids.add(relation.source); ids.add(relation.target); }
    return ids;
  }, [focusSeedIds, filteredStatementIds, visibleRelations]);
  const visibleStatements = useMemo(() => timeline.statements.filter((statement) => visibleStatementIds.has(statement.id)), [timeline.statements, visibleStatementIds]);
  const visiblePeopleIds = useMemo(() => {
    if (focusSeedIds) {
      const ids = new Set(visibleStatements.map((statement) => statement.personId));
      if (focus) ids.add(focus);
      return ids;
    }
    if (domains.size) return new Set(visibleStatements.map((statement) => statement.personId));
    if (normalizedQuery) return new Set([...queryPeopleIds, ...visibleStatements.map((statement) => statement.personId)].filter((id) => personPasses.has(id)));
    return new Set(personPasses);
  }, [personPasses, focusSeedIds, visibleStatements, domains, normalizedQuery, queryPeopleIds, focus]);
  const visiblePeopleData = useMemo(() => timeline.people.filter((person) => visiblePeopleIds.has(person.id)), [timeline.people, visiblePeopleIds]);
  const statementCountByPerson = useMemo(() => {
    const counts = new Map<string, number>();
    for (const statement of visibleStatements) counts.set(statement.personId, (counts.get(statement.personId) ?? 0) + 1);
    return counts;
  }, [visibleStatements]);
  const visiblePeople = useMemo(() => buildPersonPoints(visiblePeopleData, statementCountByPerson), [visiblePeopleData, statementCountByPerson]);
  const visiblePersonPointMap = useMemo(() => new Map(visiblePeople.map((point) => [point.id, point])), [visiblePeople]);
  const visibleStatementPoints = useMemo(() => buildStatementPoints(visibleStatements, visiblePersonPointMap), [visibleStatements, visiblePersonPointMap]);
  const visibleStatementPointMap = useMemo(() => new Map(visibleStatementPoints.map((point) => [point.id, point])), [visibleStatementPoints]);
  const hoveredStatement = hoverStatementId ? statementsById.get(hoverStatementId) : null;
  const renderMode = focus || statementFocus || zoom >= STATIC_OVERVIEW_ZOOM ? "detail" : "overview";
  const isOverview = renderMode === "overview";
  const showPortraits = zoom >= 0.28 || Boolean(focus || statementFocus);
  const isDetailZoom = zoom >= 0.82 || Boolean(focus || statementFocus);
  const viewportBounds = useMemo(() => {
    const margin = 140 / zoom;
    return {
      minX: (0 - CENTER.x - pan.x) / zoom + CENTER.x - margin,
      maxX: (WIDTH - CENTER.x - pan.x) / zoom + CENTER.x + margin,
      minY: (0 - CENTER.y - pan.y) / zoom + CENTER.y - margin,
      maxY: (HEIGHT - CENTER.y - pan.y) / zoom + CENTER.y + margin,
    };
  }, [zoom, pan.x, pan.y]);
  const renderPeople = useMemo(() => isOverview ? [] : visiblePeople.filter((point) => point.x >= viewportBounds.minX && point.x <= viewportBounds.maxX && point.y >= viewportBounds.minY && point.y <= viewportBounds.maxY), [isOverview, visiblePeople, viewportBounds]);
  const renderStatements = useMemo(() => isOverview ? [] : visibleStatementPoints.filter((point) => point.x >= viewportBounds.minX && point.x <= viewportBounds.maxX && point.y >= viewportBounds.minY && point.y <= viewportBounds.maxY), [isOverview, visibleStatementPoints, viewportBounds]);
  const renderStatementIds = useMemo(() => new Set(renderStatements.map((statement) => statement.id)), [renderStatements]);
  const relationPaths = useMemo(() => visibleRelations.flatMap((relation) => {
    const source = visibleStatementPointMap.get(relation.source);
    const target = visibleStatementPointMap.get(relation.target);
    if (!source || !target) return [];
    return [{ relation, source, target, d: relationCurve(source, target, relation.kind === "positive" ? 1 : -1, relation.id) }];
  }), [visibleRelations, visibleStatementPointMap]);
  const overviewRelationPaths = useMemo(() => ({
    positive: relationPaths.filter(({ relation }) => relation.kind === "positive").map(({ d }) => d).join(" "),
    negative: relationPaths.filter(({ relation }) => relation.kind === "negative").map(({ d }) => d).join(" "),
  }), [relationPaths]);
  const interactiveRelationPaths = useMemo(() => isOverview ? [] : relationPaths.filter(({ relation }) => renderStatementIds.has(relation.source) || renderStatementIds.has(relation.target)), [isOverview, relationPaths, renderStatementIds]);
  const overviewFields = useMemo(() => {
    const peopleByColor = new Map<string, string[]>();
    const statementsByColor = new Map<string, string[]>();
    const labels: string[] = [];
    for (const person of visiblePeople) {
      const paths = peopleByColor.get(person.color) ?? [];
      paths.push(circleSubpath(person.x, person.y, person.layoutStatementCount ? 5 : 3));
      peopleByColor.set(person.color, paths);
      labels.push(rectSubpath(person.x + 10, person.y - 5, compactWidth(`${person.name}${person.dateLabel}`, 7, 28, 120), 10));
    }
    for (const statement of visibleStatementPoints) {
      const paths = statementsByColor.get(statement.color) ?? [];
      paths.push(circleSubpath(statement.x, statement.y, 2.2));
      statementsByColor.set(statement.color, paths);
      labels.push(rectSubpath(statement.x + 8, statement.y - 3, compactWidth(statement.text, 2.8, 32, 180), 6));
    }
    return {
      people: [...peopleByColor].map(([color, paths]) => ({ color, d: paths.join(" ") })),
      statements: [...statementsByColor].map(([color, paths]) => ({ color, d: paths.join(" ") })),
      labels: labels.join(" "),
    };
  }, [visiblePeople, visibleStatementPoints]);
  const overviewStrokeZoom = 2 ** Math.round(Math.log2(Math.max(MIN_ZOOM, Math.min(STATIC_OVERVIEW_ZOOM, zoom))));
  const overviewSnapshot = useMemo(() => {
    const overviewStrokeWidth = Math.max(1.45, 0.9 / overviewStrokeZoom).toFixed(2);
    const furthestPoint = Math.max(
      WIDTH,
      HEIGHT,
      ...visiblePeople.map((point) => Math.max(point.x, point.y)),
      ...visibleStatementPoints.map((point) => Math.max(point.x, point.y)),
    ) + 400;
    const origin = -furthestPoint;
    const size = furthestPoint * 3;
    const paths = [
      overviewRelationPaths.positive && `<path d="${overviewRelationPaths.positive}" fill="none" stroke="#22b14c" stroke-width="${overviewStrokeWidth}" stroke-linecap="round" opacity=".62"/>`,
      overviewRelationPaths.negative && `<path d="${overviewRelationPaths.negative}" fill="none" stroke="#e04455" stroke-width="${overviewStrokeWidth}" stroke-linecap="round" opacity=".62"/>`,
      ...overviewFields.people.map((field) => `<path d="${field.d}" fill="${field.color}"/>`),
      ...overviewFields.statements.map((field) => `<path d="${field.d}" fill="${field.color}"/>`),
      `<path d="${overviewFields.labels}" fill="${dark ? "#f1efe9" : "#171714"}" opacity=".78"/>`,
    ].filter(Boolean).join("");
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${origin} ${origin} ${size} ${size}">${paths}</svg>`;
    return {
      href: `data:image/svg+xml,${encodeURIComponent(markup)}`,
      origin,
      size,
    };
  }, [dark, overviewFields, overviewRelationPaths, visiblePeople, visibleStatementPoints, overviewStrokeZoom]);
  const searchResults = normalizedQuery ? visiblePeople.slice(0, 8) : [];
  const domainTerms = timeline.domains;
  const layoutKey = `${[...visiblePeopleIds].sort().join(",")}|${[...visibleStatementIds].sort().join(",")}`;

  const detailPerson = useMemo(() => {
    if (showDetail !== "person" || !focus) return null;
    return timeline.people.find((p) => p.id === focus) ?? null;
  }, [showDetail, focus, timeline.people]);

  const detailStatement = useMemo(() => {
    if (showDetail !== "statement" || !statementFocus) return null;
    return statementsById.get(statementFocus) ?? null;
  }, [showDetail, statementFocus, statementsById]);

  const detailRelation = useMemo(() => {
    if (showDetail !== "relation" || !relationFocus) return null;
    return timeline.relations.find((r) => r.id === relationFocus) ?? null;
  }, [showDetail, relationFocus, timeline.relations]);

  const detailPersonStatements = useMemo(() => {
    if (!detailPerson) return [];
    return timeline.statements.filter((s) => s.personId === detailPerson.id);
  }, [detailPerson, timeline.statements]);

  const detailRelatedRelations = useMemo(() => {
    if (showDetail === "statement" && statementFocus) {
      return timeline.relations.filter((r) => r.source === statementFocus || r.target === statementFocus);
    }
    if (showDetail === "person" && focus) {
      const personStmtIds = new Set(timeline.statements.filter((s) => s.personId === focus).map((s) => s.id));
      return timeline.relations.filter((r) => personStmtIds.has(r.source) || personStmtIds.has(r.target));
    }
    return [];
  }, [showDetail, statementFocus, focus, timeline.relations, timeline.statements]);

  const detailRelatedStatements = useMemo(() => {
    if (showDetail === "statement" && statementFocus) {
      const ids = new Set<string>();
      for (const r of detailRelatedRelations) { ids.add(r.source); ids.add(r.target); }
      ids.delete(statementFocus);
      return timeline.statements.filter((s) => ids.has(s.id));
    }
    return [];
  }, [showDetail, statementFocus, detailRelatedRelations, timeline.statements]);

  useEffect(() => {
    const point = statementFocus
      ? visibleStatementPointMap.get(statementFocus)
      : focus
        ? visiblePersonPointMap.get(focus)
        : null;
    if (!point) return;
    const start = readView();
    const targetZoom = Math.max(1.2, start.zoom);
    const target = {
      zoom: targetZoom,
      pan: {
        x: (CENTER.x - point.x) * targetZoom,
        y: (CENTER.y - point.y) * targetZoom,
      },
    };
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 720;
    const startedAt = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const next = {
        zoom: start.zoom + (target.zoom - start.zoom) * eased,
        pan: {
          x: start.pan.x + (target.pan.x - start.pan.x) * eased,
          y: start.pan.y + (target.pan.y - start.pan.y) * eased,
        },
      };
      setView(next);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [focus, statementFocus, visiblePersonPointMap, visibleStatementPointMap]);

  function handleSelectStatement(id: string) {
    setStatementFocus(id);
  }

  function handleSelectPerson(id: string) {
    setFocus(id);
    setStatementFocus(null);
  }

  function handleClearPersonFocus() {
    setFocus(null);
    setStatementFocus(null);
  }

  function handleClearStatementFocus() {
    setStatementFocus(null);
  }

  function handleShowFurtherConnections() {
    setFocus(null);
  }

  function handleCloseDetail() {
    setShowDetail(null);
  }

  function handleSelectRelation(id: string) {
    const isSame = relationFocus === id;
    setRelationFocus(isSame ? null : id);
  }

  useEffect(() => {
    if (focus || statementFocus) return;
    const frame = window.requestAnimationFrame(() => setView(fitViewForPeople(visiblePeopleData, statementCountByPerson)));
    return () => window.cancelAnimationFrame(frame);
  }, [layoutKey, visiblePeopleData, statementCountByPerson, focus, statementFocus]);

  function toggle<T extends string>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, id: T) {
    setter((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function resetView() { setView(fitViewForPeople(visiblePeopleData, statementCountByPerson)); }

  function zoomAround(anchor: { x: number; y: number }, requestedZoom: number) {
    setView((current) => zoomAt(current, anchor, requestedZoom, CENTER));
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    const start = drag.current;
    const scale = WIDTH / event.currentTarget.getBoundingClientRect().width;
    const dx = (event.clientX - start.x) * scale;
    const dy = (event.clientY - start.y) * scale;
    setView((current) => ({ ...current, pan: { x: start.panX + dx, y: start.panY + dy } }));
  }

  const transform = `translate(${pan.x} ${pan.y}) translate(${CENTER.x} ${CENTER.y}) scale(${zoom}) translate(${-CENTER.x} ${-CENTER.y})`;

  return <main className={`timeline-app ${dark ? "is-dark" : ""}`}>
    <aside className="tool-rail" data-i18n-scope="timeline-toolbar" aria-label={messages["topbar.view"]}>
      <button className="zoom-tool" onClick={() => zoomAround(CENTER, Math.min(MAX_ZOOM, zoom * 1.24))} aria-label={messages["toolbar.zoomIn"]}>{icon("plus")}</button>
      <button className="zoom-tool" onClick={() => zoomAround(CENTER, Math.max(MIN_ZOOM, zoom / 1.24))} aria-label={messages["toolbar.zoomOut"]}>{icon("minus")}</button>
      <button className="fit-tool" onClick={resetView} aria-label={messages["toolbar.fit"]}>{icon("fit")}</button>
      <button className="theme-tool" onClick={() => setDark((value) => !value)} aria-label={messages["toolbar.theme"]}>{icon("theme")}</button>
      <button className={`legend-tool ${showLegend ? "active" : ""}`} onClick={() => setShowLegend((value) => !value)} aria-label={messages["toolbar.legend"]}>{icon("legend")}</button>
      <button className={`filter-tool ${showFilters ? "active" : ""}`} onClick={() => setShowFilters((value) => !value)} aria-label={messages["filters.title"]} aria-expanded={showFilters}>{icon("filter")}</button>
    </aside>

    {focus && <button className="clear-focus-btn clear-person-focus" onClick={handleClearPersonFocus} aria-label={messages["toolbar.clearPersonFocus"]}><span className="clear-focus-icon">{icon("back")}</span><span>{messages["toolbar.clearPersonFocus"]}</span></button>}
    {statementFocus && <button className="clear-focus-btn clear-statement-focus" onClick={handleClearStatementFocus} aria-label={messages["toolbar.clearStatementFocus"]}><span className="clear-focus-icon">{icon("back")}</span><span>{messages["toolbar.clearStatementFocus"]}</span></button>}

    <header className="topbar" data-i18n-scope="timeline-topbar">
      <div className="search-wrap"><label className="search-control">{icon("search")}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={messages["topbar.search"]} /></label>
        {searchResults.length > 0 && <div className="search-results">{searchResults.map((person) => <button key={person.id} onClick={() => { setFocus(person.id); setStatementFocus(null); setQuery(""); }}><strong>{person.name}</strong><span>{person.dateLabel}</span></button>)}</div>}
      </div>
      <span className="view-pill">{messages["topbar.view"]}</span><Link className="language-pill" href={`/${alternateLocale(locale)}`}>{messages["language.switch"]}</Link><button className="round-button" onClick={() => setShowInfo(true)} aria-label={messages["topbar.info"]}>{icon("info")}</button>
    </header>

    <div className="research-note" data-i18n-scope="brand">{messages["status.research"]}</div>

    <section className="canvas-wrap" data-i18n-scope="timeline-canvas" aria-label={messages["topbar.view"]}>
      <svg ref={canvas} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" data-render-mode={renderMode} data-zoom={zoom.toFixed(4)} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <g className="timeline-viewport" transform={transform}>
          {isOverview && <image
            className="overview-static-image"
            data-overview-static="true"
            href={overviewSnapshot.href}
            x={overviewSnapshot.origin}
            y={overviewSnapshot.origin}
            width={overviewSnapshot.size}
            height={overviewSnapshot.size}
            pointerEvents="none"
          />}
          <g className={`statement-relations ${isOverview ? "is-overview" : ""} ${hoverPersonId || hoverStatementId ? "has-hover" : ""}`} shapeRendering={isOverview ? "optimizeSpeed" : "auto"}>
          {!isOverview && interactiveRelationPaths.map(({ relation, source, target, d }) => {
            const relationHovered = hoverPersonId
              ? source.personId === hoverPersonId || target.personId === hoverPersonId
              : hoverStatementId
                ? relation.source === hoverStatementId || relation.target === hoverStatementId
                : false;
            const relationFaded = Boolean(hoverPersonId || hoverStatementId) && !relationHovered;
            return <path key={relation.id} className={`statement-relation ${relation.kind} ${relationFocus === relation.id ? "selected" : ""} ${relationHovered ? "is-hovered" : ""} ${relationFaded ? "is-faded" : ""}`} data-relation-kind={relation.kind} data-relation-id={relation.id} d={d} fill="none" style={{ strokeWidth: Math.max(1.45, 0.9 / zoom) }} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); handleSelectRelation(relation.id); }} />;
          })}</g>
          {renderPeople.map((person) => {
            const isHoverFaded = hoverPersonId
              ? hoverPersonId !== person.id
              : hoveredStatement
                ? hoveredStatement.personId !== person.id
                : false;
            return <g key={person.id} data-person-id={person.id} data-layout-rank={person.rank} data-sort-year={person.sortYear} data-statement-count={person.layoutStatementCount} className={`person-node importance-${person.importance} ${focus === person.id ? "focused" : ""} ${isHoverFaded ? "is-faded" : ""}`} transform={`translate(${person.x} ${person.y})`} role="button" tabIndex={0} aria-pressed={focus === person.id} aria-label={`${person.name}, ${person.dateLabel}`} onPointerEnter={() => setHoverPersonId(person.id)} onPointerLeave={() => setHoverPersonId((current) => current === person.id ? null : current)} onFocus={() => setHoverPersonId(person.id)} onBlur={() => setHoverPersonId((current) => current === person.id ? null : current)} onPointerDown={(event) => event.stopPropagation()} onClick={() => handleSelectPerson(person.id)}>
            {focus === person.id && <circle className="selection-ring" r="11" />}<circle className="person-dot" r={showPortraits ? 8 : person.layoutStatementCount ? 5 : 3} style={{ fill: person.color }} />
            {showPortraits && <><image className="person-portrait" href={person.portrait.path} x="-7" y="-7" width="14" height="14" preserveAspectRatio="xMidYMid slice" /><circle className="person-portrait-outline" r="7" /></>}
            {renderMode === "detail"
              ? <g className="person-label"><text className="person-name" x="10" y="0" dominantBaseline="central">{person.name}<tspan className="person-date-inline" dx="8">{person.dateLabel}</tspan></text></g>
              : <rect className="compact-label-block person-block" x="10" y="-5" width={compactWidth(`${person.name}${person.dateLabel}`, 7, 28, 120)} height="10" />}
          </g>;
          })}
          {renderStatements.map((point) => { const statement = point;
            const isHoverFaded = hoverPersonId
              ? hoverPersonId !== statement.personId
              : hoverStatementId
                ? hoverStatementId !== statement.id
                : false;
            return <g key={statement.id} data-person-id={statement.personId} data-order={point.layoutOrder} data-content-type={statement.contentType} className={`statement-node content-${statement.contentType} ${statementFocus === statement.id ? "focused" : ""} ${isHoverFaded ? "is-faded" : ""}`} transform={`translate(${point.x} ${point.y})`} role="button" tabIndex={0} aria-pressed={statementFocus === statement.id} aria-label={statement.text} onPointerEnter={() => setHoverStatementId(statement.id)} onPointerLeave={() => setHoverStatementId((current) => current === statement.id ? null : current)} onFocus={() => setHoverStatementId(statement.id)} onBlur={() => setHoverStatementId((current) => current === statement.id ? null : current)} onPointerDown={(event) => event.stopPropagation()} onClick={() => handleSelectStatement(statement.id)}>
              {statementFocus === statement.id && <circle className="statement-selection-ring" r="7" />}<CategoryDot domains={statement.domains} radius={isDetailZoom ? 3.3 : 2.15} />
              {renderMode === "detail"
                ? <g className="statement-copy"><text className="statement-tags" x="-10" y="4" textAnchor="end">{statement.tags.slice(0, 2).join(" · ")}</text><text className="statement-text" x="10" y="4">{statement.text}</text></g>
                : <><rect className="compact-label-block tag-block" x={-compactWidth(statement.tags.slice(0, 2).join(""), 4, 14, 48) - 8} y="-2.5" width={compactWidth(statement.tags.slice(0, 2).join(""), 4, 14, 48)} height="5" /><rect className="compact-label-block statement-block" x="8" y="-3" width={compactWidth(statement.text, 2.8, 32, 180)} height="6" /></>}
            </g>;
          })}
        </g>
      </svg>
      {focus && statementFocus && <button className="show-further-btn" onClick={handleShowFurtherConnections}><span className="show-further-icon">+</span>{messages["toolbar.showFurther"]}</button>}
      <p className="relations-note">{messages["timeline.relationsPending"]}</p>
      {visiblePeople.length === 0 && <div className="empty-state">{messages["filters.noResults"]}</div>}
    </section>

    {showFilters && <><button className="filter-backdrop" aria-label={messages["filters.close"]} onClick={() => setShowFilters(false)} /><aside className="filter-panel" data-i18n-scope="timeline-filters">
      <div className="filter-heading"><strong>{messages["filters.title"]}</strong><div>{(periods.size + domains.size > 0) && <button onClick={() => { setPeriods(new Set()); setDomains(new Set()); }}>{messages["filters.clear"]}</button>}<button className="filter-close" onClick={() => setShowFilters(false)} aria-label={messages["filters.close"]}>{icon("close")}</button></div></div>
      <h2>{messages["filters.connections"]}</h2><div className="chip-row connection-filters"><button aria-pressed={relationKinds.has("positive")} className={`filter-chip relation-chip positive ${relationKinds.has("positive") ? "selected" : ""}`} onClick={() => toggle<RelationKind>(setRelationKinds, "positive")}><i />{messages["filters.agreement"]}</button><button aria-pressed={relationKinds.has("negative")} className={`filter-chip relation-chip negative ${relationKinds.has("negative") ? "selected" : ""}`} onClick={() => toggle<RelationKind>(setRelationKinds, "negative")}><i />{messages["filters.disagreement"]}</button></div>
      <h2>{messages["filters.domains"]}</h2><div className="chip-row">{domainTerms.map((term) => <button className={`filter-chip ${domains.has(term.id) ? "selected" : ""}`} key={term.id} onClick={() => toggle(setDomains, term.id)}><i style={{ background: term.color }} />{term.label}</button>)}</div>
      <h2>{messages["filters.periods"]}</h2><div className="chip-row">{timeline.periods.map((term) => <button className={`filter-chip ${periods.has(term.id) ? "selected" : ""}`} key={term.id} onClick={() => toggle(setPeriods, term.id)}>{term.label}</button>)}</div>
      <div className="brand-lockup" data-i18n-scope="brand"><strong>{messages["brand.title"]}</strong><span>{messages["brand.subtitle"]}</span><small>{messages["brand.version"]} · schema v4 · {timeline.dataVersion}</small></div>
    </aside></>}

    {showLegend && <aside className="legend-panel" data-i18n-scope="timeline-legend"><strong>{messages["legend.title"]}</strong><span><i className="legend-dot core" />{messages["legend.person"]}</span><span><i className="legend-dot statement" />{messages["legend.statement"]}</span><div className="legend-category-dots" aria-label={messages["filters.domains"]}>{timeline.domains.map((term) => <i key={term.id} style={{ background: term.color }} title={term.label} />)}</div><span><i className="legend-line positive" />{messages["legend.agreement"]}</span><span><i className="legend-line negative" />{messages["legend.disagreement"]}</span><small>{messages["legend.structuralNote"]}</small></aside>}

    {showInfo && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowInfo(false)}><section ref={infoDialog} tabIndex={-1} className="info-modal" role="dialog" aria-modal="true" aria-labelledby="research-info-title" data-i18n-scope="research-info" onMouseDown={(event) => event.stopPropagation()}><button className="detail-close" onClick={() => setShowInfo(false)} aria-label={messages["info.close"]}>{icon("close")}</button><h1 id="research-info-title">{messages["info.title"]}</h1><p>{messages["info.body"]}</p><p>{messages["info.inclusion"]}</p><p className="info-emphasis">{messages["info.quote"]}</p><p>{messages["info.disclaimer"]}</p></section></div>}

    {showDetail && <DetailPanel
      locale={locale}
      messages={messages}
      mode={showDetail}
      statement={detailStatement}
      person={detailPerson}
      relation={detailRelation}
      relatedStatements={showDetail === "person" ? detailPersonStatements : detailRelatedStatements}
      relatedRelations={detailRelatedRelations}
      statementsById={statementsById}
      peopleById={peopleById}
      onClose={handleCloseDetail}
      onSelectStatement={handleSelectStatement}
      onSelectPerson={handleSelectPerson}
    />}
  </main>;
}
