"use client";

// Moteur de dessin (croquis du chat + tableau partagé en direct).
// Les coordonnées sont normalisées par la largeur du support : x et y sont
// exprimés en fraction de la largeur (0…1 pour x, 0…ratio pour y), ainsi
// les traits s'affichent identiques sur deux écrans de tailles différentes.

import { getStroke } from "perfect-freehand";

export type Pt = [number, number];

export interface Stroke {
  id: string;
  /** membre qui a dessiné */
  by: string;
  color: string;
  /** épaisseur relative à la largeur (ex. 0.02 = 2 % de la largeur) */
  size: number;
  erase?: boolean;
  points: Pt[];
}

export const PAPER = "#fffdf8";

export const PALETTE = [
  "#2b2420", // encre
  "#e07a5f", // terracotta
  "#d66b8f", // rose
  "#f2cc8f", // sable
  "#f4a261", // orange
  "#81b29a", // sauge
  "#3d5a80", // bleu nuit
  "#8ecae6", // ciel
  "#9b72cf", // violet
  "#ffffff", // blanc
];

export const SIZES: { value: number; label: string }[] = [
  { value: 0.008, label: "Fin" },
  { value: 0.016, label: "Moyen" },
  { value: 0.032, label: "Épais" },
  { value: 0.06, label: "Très épais" },
];

/** Rapport hauteur / largeur des dessins (portrait 3:4). */
export const BOARD_RATIO = 4 / 3;

export interface Tool {
  color: string;
  size: number;
  erase: boolean;
}

export function newStrokeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function roundPt(x: number, y: number): Pt {
  return [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000];
}

/** Garde uniquement les traits valides (données venant de la base ou du réseau). */
export function sanitizeStrokes(input: unknown): Stroke[] {
  if (!Array.isArray(input)) return [];
  return input.filter(
    (s): s is Stroke =>
      !!s && typeof s === "object" && typeof (s as Stroke).id === "string" && Array.isArray((s as Stroke).points),
  );
}

// ------------------------------------------------------------------ rendu
function pathFromOutline(outline: number[][]): Path2D {
  const p = new Path2D();
  if (!outline.length) return p;
  p.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1];
    const [x1, y1] = outline[i];
    p.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  p.closePath();
  return p;
}

const pathCache = new WeakMap<Stroke, { w: number; n: number; path: Path2D }>();

function strokePath(s: Stroke, width: number, done: boolean): Path2D {
  const cached = pathCache.get(s);
  if (cached && cached.w === width && cached.n === s.points.length) return cached.path;
  const pts = s.points.map(([x, y]) => [x * width, y * width]);
  const size = Math.max(1, s.size * width);
  const outline = getStroke(pts, {
    size,
    thinning: s.erase ? 0 : 0.5,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: !s.erase,
    last: done,
  });
  const path = pathFromOutline(outline);
  if (done) pathCache.set(s, { w: width, n: s.points.length, path });
  return path;
}

/** Dessine une liste de traits sur un contexte (fond transparent, gomme = effacement). */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], width: number, inProgress: Stroke[] = []) {
  const all: [Stroke, boolean][] = [...strokes.map((s): [Stroke, boolean] => [s, true]), ...inProgress.map((s): [Stroke, boolean] => [s, false])];
  for (const [s, done] of all) {
    if (!s.points.length) continue;
    ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    ctx.fillStyle = s.erase ? "#000" : s.color;
    ctx.fill(strokePath(s, width, done));
  }
  ctx.globalCompositeOperation = "source-over";
}

/** Exporte les traits en PNG (fond papier). */
export async function exportPng(strokes: Stroke[], outWidth = 1080, ratio = BOARD_RATIO): Promise<Blob> {
  const w = outWidth;
  const h = Math.round(outWidth * ratio);
  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  const lctx = layer.getContext("2d")!;
  drawStrokes(lctx, strokes, w);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d")!;
  octx.fillStyle = PAPER;
  octx.fillRect(0, 0, w, h);
  octx.drawImage(layer, 0, 0);
  return new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("Export impossible"))), "image/png"),
  );
}

// ------------------------------------------------------------------ modèle
/**
 * État d'un tableau : traits terminés, traits en cours des autres (temps réel)
 * et trait en cours local. Les abonnés sont prévenus à chaque changement.
 */
export class BoardModel {
  strokes: Stroke[] = [];
  remote = new Map<string, Stroke>();
  current: Stroke | null = null;
  version = 0;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getVersion = () => this.version;

  emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  setStrokes(strokes: Stroke[]) {
    this.strokes = strokes;
    this.emit();
  }

  /** Ajoute (ou remplace) un trait terminé. */
  commit(s: Stroke) {
    this.remote.delete(s.id);
    const i = this.strokes.findIndex((x) => x.id === s.id);
    if (i >= 0) this.strokes = [...this.strokes.slice(0, i), s, ...this.strokes.slice(i + 1)];
    else this.strokes = [...this.strokes, s];
    this.emit();
  }

  remove(id: string) {
    this.remote.delete(id);
    this.strokes = this.strokes.filter((s) => s.id !== id);
    this.emit();
  }

  clear() {
    this.strokes = [];
    this.remote.clear();
    this.emit();
  }

  /** Fusionne des traits reçus (synchronisation à l'arrivée d'un participant). */
  merge(list: Stroke[]) {
    const known = new Set(this.strokes.map((s) => s.id));
    const extra = list.filter((s) => !known.has(s.id));
    if (extra.length) {
      this.strokes = [...this.strokes, ...extra];
      this.emit();
    }
  }

  /** Dernier trait d'un membre (pour « annuler »). */
  lastBy(memberId: string): Stroke | undefined {
    for (let i = this.strokes.length - 1; i >= 0; i--) if (this.strokes[i].by === memberId) return this.strokes[i];
    return undefined;
  }
}
