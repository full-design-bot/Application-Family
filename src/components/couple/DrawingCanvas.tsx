"use client";

import { Eraser, Trash2, Undo2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/components/ui";
import { BOARD_RATIO, BoardModel, PALETTE, PAPER, SIZES, drawStrokes, newStrokeId, roundPt, type Pt, type Stroke, type Tool } from "./drawing";

interface DrawingCanvasProps {
  model: BoardModel;
  tool: Tool;
  meId: string;
  ratio?: number;
  className?: string;
  onBegin?: (s: Stroke) => void;
  onPoints?: (id: string, pts: Pt[]) => void;
  onEnd?: (s: Stroke) => void;
}

/**
 * Support de dessin tactile (pointer events, touch-action: none).
 * S'adapte à la place disponible en gardant le rapport hauteur/largeur.
 */
export function DrawingCanvas({ model, tool, meId, ratio = BOARD_RATIO, className, onBegin, onPoints, onEnd }: DrawingCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toolRef = useRef(tool);
  const cbRef = useRef({ onBegin, onPoints, onEnd, meId });

  useEffect(() => {
    toolRef.current = tool;
    cbRef.current = { onBegin, onPoints, onEnd, meId };
  });

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = { w: 0, h: 0, dpr: 1 };
    let frame = 0;
    let pointerId: number | null = null;

    const render = () => {
      frame = 0;
      if (!size.w) return;
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);
      const inProgress = [...model.remote.values()];
      if (model.current) inProgress.push(model.current);
      drawStrokes(ctx, model.strokes, size.w, inProgress);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    const resize = () => {
      const cs = getComputedStyle(wrap);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const availW = wrap.clientWidth - padX;
      const availH = wrap.clientHeight - padY > 0 ? wrap.clientHeight - padY : availW * ratio;
      const w = Math.floor(Math.min(availW, availH / ratio));
      const h = Math.floor(w * ratio);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      size.w = w;
      size.h = h;
      size.dpr = dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      render();
    };

    const toPt = (e: PointerEvent): Pt => {
      const r = canvas.getBoundingClientRect();
      return roundPt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.width);
    };

    const down = (e: PointerEvent) => {
      if (pointerId !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      pointerId = e.pointerId;
      const t = toolRef.current;
      const s: Stroke = {
        id: newStrokeId(),
        by: cbRef.current.meId,
        color: t.color,
        size: t.size,
        ...(t.erase ? { erase: true } : {}),
        points: [toPt(e)],
      };
      model.current = s;
      schedule();
      cbRef.current.onBegin?.(s);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId || !model.current) return;
      e.preventDefault();
      const evs = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
      const pts = (evs.length ? evs : [e]).map(toPt);
      model.current.points.push(...pts);
      schedule();
      cbRef.current.onPoints?.(model.current.id, pts);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      const s = model.current;
      model.current = null;
      if (s) {
        model.commit(s);
        cbRef.current.onEnd?.(s);
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    const unsub = model.subscribe(schedule);
    canvas.addEventListener("pointerdown", down, { passive: false });
    canvas.addEventListener("pointermove", move, { passive: false });
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    const stopTouch = (e: TouchEvent) => e.preventDefault();
    canvas.addEventListener("touchstart", stopTouch, { passive: false });
    canvas.addEventListener("touchmove", stopTouch, { passive: false });

    return () => {
      ro.disconnect();
      unsub();
      if (frame) cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("touchstart", stopTouch);
      canvas.removeEventListener("touchmove", stopTouch);
    };
  }, [model, ratio]);

  return (
    <div ref={wrapRef} className={cn("flex items-center justify-center overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        className="rounded-3xl shadow-sm ring-1 ring-line select-none"
        style={{ background: PAPER, touchAction: "none" }}
      />
    </div>
  );
}

/** Palette, épaisseurs, gomme, annuler, effacer tout. */
export function DrawingToolbar({
  tool,
  onChange,
  onUndo,
  onClear,
  canUndo,
  className,
}: {
  tool: Tool;
  onChange: (t: Tool) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-1 py-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Couleur ${c}`}
            onClick={() => onChange({ ...tool, color: c, erase: false })}
            className={cn(
              "size-9 shrink-0 rounded-full border border-line transition",
              !tool.erase && tool.color === c ? "scale-110 ring-2 ring-accent ring-offset-2 ring-offset-bg" : "",
            )}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1">
        {SIZES.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-label={s.label}
            title={s.label}
            onClick={() => onChange({ ...tool, size: s.value })}
            className={cn(
              "flex size-11 items-center justify-center rounded-2xl transition",
              tool.size === s.value ? "bg-card-2 ring-1 ring-line" : "",
            )}
          >
            <span
              className="rounded-full"
              style={{
                width: 6 + s.value * 300,
                height: 6 + s.value * 300,
                background: tool.erase ? "var(--muted)" : tool.color,
                boxShadow: "0 0 0 1px var(--line)",
              }}
            />
          </button>
        ))}
        <button
          type="button"
          aria-label="Gomme"
          title="Gomme"
          onClick={() => onChange({ ...tool, erase: !tool.erase })}
          className={cn(
            "ml-auto flex size-11 items-center justify-center rounded-2xl transition",
            tool.erase ? "bg-accent text-accent-ink" : "text-ink active:bg-card-2",
          )}
        >
          <Eraser className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Annuler"
          title="Annuler"
          disabled={!canUndo}
          onClick={onUndo}
          className="flex size-11 items-center justify-center rounded-2xl text-ink transition active:bg-card-2 disabled:opacity-30"
        >
          <Undo2 className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Effacer tout"
          title="Effacer tout"
          onClick={onClear}
          className="flex size-11 items-center justify-center rounded-2xl text-danger transition active:bg-card-2"
        >
          <Trash2 className="size-5" />
        </button>
      </div>
    </div>
  );
}
