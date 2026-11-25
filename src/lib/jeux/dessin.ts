// « Dessine, je devine » : traits stockés en coordonnées normalisées (0..1000)
// pour s'afficher pareil sur les deux écrans.

import getStroke from "perfect-freehand";

export const CANVAS = 1000;
export const MAX_STROKES = 400;

export interface Stroke {
  id: string;
  color: string;
  size: number;
  points: [number, number][];
}

export const PALETTE = ["#2b2420", "#e07a5f", "#3d5a80", "#81b29a", "#f2cc8f", "#d66b8f", "#8a5cf6"];
export const SIZES = [8, 16, 32];

export function normalizeStrokes(value: unknown): Stroke[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (s): s is Stroke => !!s && typeof (s as Stroke).id === "string" && Array.isArray((s as Stroke).points),
  );
}

/** Arrondit et borne un point. */
export function clampPoint(x: number, y: number): [number, number] {
  const c = (v: number) => Math.max(0, Math.min(CANVAS, Math.round(v)));
  return [c(x), c(y)];
}

/** Retire les points trop proches (allège les données envoyées). */
export function thinPoints(points: [number, number][], minDistance = 3): [number, number][] {
  if (points.length <= 2) return points;
  const out: [number, number][] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = out[out.length - 1];
    const [x, y] = points[i];
    if (Math.hypot(x - px, y - py) >= minDistance) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

function average(a: number, b: number) {
  return (a + b) / 2;
}

/** Contour perfect-freehand → chemin SVG. */
export function svgPathFromOutline(points: number[][]): string {
  const len = points.length;
  if (len < 4) return "";
  let a = points[0];
  let b = points[1];
  const c = points[2];
  let result = `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${b[0].toFixed(1)},${b[1].toFixed(1)} ${average(b[0], c[0]).toFixed(1)},${average(b[1], c[1]).toFixed(1)} T`;
  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${average(a[0], b[0]).toFixed(1)},${average(a[1], b[1]).toFixed(1)} `;
  }
  return result + "Z";
}

export function strokePath(stroke: Pick<Stroke, "points" | "size">, complete = true): string {
  const outline = getStroke(stroke.points, {
    size: stroke.size,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,
    last: complete,
  });
  return svgPathFromOutline(outline);
}
