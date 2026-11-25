"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { Spinner, cn } from "@/components/ui";
import { useSignedUrl } from "@/lib/media";

/** Affichage plein écran d'une image du stockage privé. */
export function FullscreenImage({
  path,
  onClose,
  header,
  footer,
  protect,
  paper,
}: {
  path: string | null;
  onClose: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** empêche l'appui long « Enregistrer l'image » (photos éphémères) */
  protect?: boolean;
  /** fond papier (dessins) */
  paper?: boolean;
}) {
  const url = useSignedUrl(path);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true">
      <div className="flex items-center gap-2 px-3 pt-safe">
        <div className="min-w-0 flex-1 py-3 text-sm">{header}</div>
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="mt-1 inline-flex size-11 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
        >
          <X className="size-6" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3" onClick={protect ? undefined : onClose}>
        {url ? (
          <img
            src={url}
            alt=""
            draggable={false}
            onContextMenu={protect ? (e) => e.preventDefault() : undefined}
            className={cn("max-h-full max-w-full rounded-2xl object-contain select-none", paper && "bg-[#fffdf8]", protect && "pointer-events-none")}
            style={protect ? { WebkitTouchCallout: "none" } : undefined}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <Spinner className="text-white/70" />
        )}
      </div>
      {footer && <div className="px-4 pb-safe pt-2">{footer}</div>}
      <div className="h-4" />
    </div>
  );
}

/** Cœurs qui s'envolent (animation déclenchée par un compteur). */
export function FloatingHearts({ bursts, emoji = "💛" }: { bursts: { id: number; x: number; delay: number; size: number }[]; emoji?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {bursts.map((b) => (
        <span
          key={b.id}
          className="animate-floatup absolute bottom-1/2"
          style={{ left: `${b.x}%`, animationDelay: `${b.delay}ms`, fontSize: b.size, opacity: 0 }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}

export type HeartBurst = { id: number; x: number; delay: number; size: number };

/** Génère une salve de cœurs (à appeler dans un gestionnaire d'événement). */
export function makeHearts(count = 9): HeartBurst[] {
  const base = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: base + i + Math.random(),
    x: 15 + Math.random() * 70,
    delay: Math.random() * 350,
    size: 18 + Math.random() * 18,
  }));
}
