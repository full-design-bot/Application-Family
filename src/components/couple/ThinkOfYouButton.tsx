"use client";

import { useState } from "react";
import { cn, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { FloatingHearts, makeHearts, type HeartBurst } from "./FullscreenImage";
import { useThoughtsToday } from "./hooks";
import { sendThought } from "./lib";

function thoughtsLabel(name: string, n: number): string {
  if (n === 0) return `${name} n'a pas encore pensé à toi aujourd'hui… enfin, pas en appuyant 😉`;
  if (n === 1) return `${name} a pensé à toi 1 fois aujourd'hui`;
  return `${name} a pensé à toi ${n} fois aujourd'hui`;
}

/**
 * Bouton « 💛 Je pense à toi » : envoie un petit message spécial + une
 * notification à l'autre parent, avec des cœurs qui s'envolent.
 *  - variant "compact" (défaut) : pastille pour l'accueil
 *  - variant "large" : grand bouton + compteur (page Nous deux)
 */
export function ThinkOfYouButton({ variant = "compact", className }: { variant?: "compact" | "large"; className?: string }) {
  const { me, partner, isParent } = useFamily();
  const toast = useToast();
  const count = useThoughtsToday();
  const [hearts, setHearts] = useState<HeartBurst[]>([]);
  const [busy, setBusy] = useState(false);

  if (!isParent) return null;
  const partnerName = partner?.display_name ?? "ton amour";

  async function send() {
    if (busy) return;
    setHearts(makeHearts(variant === "large" ? 14 : 8));
    setBusy(true);
    try {
      await sendThought(me.id, me.display_name);
      toast(`💛 ${partnerName} va le sentir !`, "success");
    } catch {
      toast("Oups, ça n'est pas passé 😕", "error");
    } finally {
      setTimeout(() => setBusy(false), 1500);
    }
  }

  if (variant === "large") {
    return (
      <div className={cn("flex flex-col items-center py-2", className)}>
        <div className="relative">
          <FloatingHearts bursts={hearts} />
          <button
            type="button"
            onClick={send}
            className={cn(
              "relative flex size-44 flex-col items-center justify-center rounded-full bg-gradient-to-br from-rose to-accent text-white shadow-lg transition active:scale-95",
              busy && "scale-95",
            )}
          >
            <span key={hearts[0]?.id ?? 0} className="animate-pop text-6xl">
              💛
            </span>
            <span className="mt-1 font-display text-lg font-bold leading-tight">Je pense à toi</span>
          </button>
        </div>
        <p className="mt-4 text-center text-sm text-muted">{thoughtsLabel(partnerName, count)}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={send}
      className={cn(
        "relative inline-flex h-11 items-center gap-2 rounded-full bg-rose-soft px-4 font-semibold text-rose transition active:scale-95",
        className,
      )}
    >
      <FloatingHearts bursts={hearts} />
      <span className="text-lg">💛</span>
      Je pense à toi
      {count > 0 && (
        <span className="rounded-full bg-rose px-1.5 text-xs font-bold leading-5 text-white" title={thoughtsLabel(partnerName, count)}>
          {count}
        </span>
      )}
    </button>
  );
}
