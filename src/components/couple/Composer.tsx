"use client";

import { Camera, Plus, SendHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";

/** Décalage du clavier iOS (visualViewport) pour garder la zone de saisie visible. */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const d = window.innerHeight - vv.height - vv.offsetTop;
      setInset(d > 80 ? Math.round(d) : 0);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/**
 * Zone de saisie fixée au-dessus de la barre d'onglets, qui s'agrandit avec
 * le texte. `onHeight` permet à la page de réserver la place en bas.
 */
export function Composer({
  onSend,
  onPlus,
  onPhoto,
  onHeight,
  disabled,
  uploading,
}: {
  onSend: (text: string) => Promise<boolean> | boolean;
  onPlus: () => void;
  onPhoto: (file: File) => void;
  onHeight?: (h: number) => void;
  disabled?: boolean;
  uploading?: boolean;
}) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inset = useKeyboardInset();

  // Auto-agrandissement (jusqu'à ~6 lignes)
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }, [text]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !onHeight) return;
    const ro = new ResizeObserver(() => onHeight(box.offsetHeight));
    ro.observe(box);
    onHeight(box.offsetHeight);
    return () => ro.disconnect();
  }, [onHeight]);

  async function submit() {
    const t = text.trim();
    if (!t || disabled) return;
    setText("");
    const ok = await onSend(t);
    if (!ok) setText(t);
    taRef.current?.focus();
  }

  return (
    <div
      ref={boxRef}
      className={cn("fixed inset-x-0 z-30 border-t border-line bg-bg/95 backdrop-blur-xl", !inset && "bottom-[calc(64px+env(safe-area-inset-bottom))]")}
      style={inset ? { bottom: inset } : undefined}
    >
      <div className="mx-auto flex max-w-lg items-end gap-1.5 px-3 py-2">
        <button
          type="button"
          aria-label="Plus d'options"
          onClick={onPlus}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent active:brightness-95"
        >
          <Plus className="size-6" />
        </button>
        <button
          type="button"
          aria-label="Envoyer une photo"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-card-2 disabled:opacity-40"
        >
          <Camera className={cn("size-6", uploading && "animate-pulse")} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPhoto(f);
            e.target.value = "";
          }}
        />
        <textarea
          ref={taRef}
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Un petit mot…"
          className="max-h-[150px] min-h-11 flex-1 resize-none rounded-3xl border border-line bg-card px-4 py-2.5 leading-snug text-ink outline-none placeholder:text-muted/70 focus:border-accent"
        />
        <button
          type="button"
          aria-label="Envoyer"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void submit()}
          disabled={!text.trim() || disabled}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition active:brightness-95 disabled:opacity-40"
        >
          <SendHorizontal className="size-5" />
        </button>
      </div>
    </div>
  );
}
