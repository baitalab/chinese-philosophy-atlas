export type Point = { x: number; y: number };

export type TimelineView = {
  zoom: number;
  pan: Point;
};

export const MIN_ZOOM = 0.005;
export const MAX_ZOOM = 5.2;
// Rows advance in the same 1:1 world direction as the ranked person flow.
// The whole content stream then scales naturally: distant rows read as a line,
// while zooming reveals the individual statement points.
export const STATEMENT_FIRST_ROW = { x: 40, y: 40 };
export const STATEMENT_ROW_STEP = { x: 40, y: 40 };

export function clampZoom(zoom: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/** Keep the world point under `anchor` fixed while changing zoom. */
export function zoomAt(view: TimelineView, anchor: Point, requestedZoom: number, center: Point): TimelineView {
  const zoom = clampZoom(requestedZoom);
  if (zoom === view.zoom) return view;
  const ratio = zoom / view.zoom;
  return {
    zoom,
    pan: {
      x: anchor.x - center.x - ratio * (anchor.x - center.x - view.pan.x),
      y: anchor.y - center.y - ratio * (anchor.y - center.y - view.pan.y),
    },
  };
}

/** Place each statement in the next content slot after its person heading. */
export function statementPoint(person: Point, order: number): Point {
  const row = Math.max(0, order - 1);
  return {
    x: person.x + STATEMENT_FIRST_ROW.x + STATEMENT_ROW_STEP.x * row,
    y: person.y + STATEMENT_FIRST_ROW.y + STATEMENT_ROW_STEP.y * row,
  };
}

function stableVariation(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return ((Math.abs(hash) % 17) - 8) / 100;
}

/**
 * Draw a near-semicircle whose diameter follows the timeline chord. As the
 * corpus grows, nested relation spans therefore accumulate into the circular
 * fields on either side of the timeline instead of flattening into parabolas.
 */
export function relationCurve(source: Point, target: Point, side: 1 | -1, id: string) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const chord = Math.max(0.001, Math.hypot(dx, dy));
  // Relation records may name their endpoints in either order. Normalize the
  // bend against the upper-left → lower-right timeline flow so `side` always
  // means the same visual side of the stream.
  const flowDirection = dx + dy >= 0 ? 1 : -1;
  const separation = ((stableVariation(id) + 0.08) / 0.16) * 0.025;
  const radius = chord * (0.5 + separation);
  const sweep = side * flowDirection > 0 ? 0 : 1;
  return `M ${source.x.toFixed(2)} ${source.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 ${sweep} ${target.x.toFixed(2)} ${target.y.toFixed(2)}`;
}

export function clientPointInSvg(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: clientX, y: clientY };
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}
