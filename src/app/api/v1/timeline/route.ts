import { NextRequest, NextResponse } from "next/server";
import { getResearchTimeline } from "@/data/research-corpus";
import { defaultLocale, isLocale } from "@/i18n/config";

export function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("lang") ?? defaultLocale;
  const locale = isLocale(requested) ? requested : defaultLocale;
  const timeline = getResearchTimeline(locale);
  return NextResponse.json({
    data: {
      people: timeline.people,
      statements: timeline.statements,
      nodes: timeline.nodes,
      relations: timeline.relations,
      filters: { periods: timeline.periods, traditions: timeline.traditions, domains: timeline.domains },
      coverage: timeline.coverage,
    },
    meta: {
      locale,
      requestedLocale: requested,
      localeFallbackUsed: requested !== locale,
      fieldFallbacks: timeline.fallbackFields,
      dataStatus: "research-register-with-published-claims-only",
      registryPeople: timeline.coverage.people,
      publishedClaimPeople: timeline.coverage.peopleWithPositions,
      publishedClaims: timeline.coverage.positionStatements,
      relationsStatus: "published-statement-relations-with-record-level-review-status",
      directionSemantics: "undirected-conceptual-connection-not-necessarily-historical-influence",
      dataVersion: timeline.dataVersion,
      schemaVersion: 4,
    },
  });
}
