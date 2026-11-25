"use client";

// Petits composants d'affichage des sorties : image, carte de liste, étoiles, filtres de catégorie.

import Link from "next/link";
import { useState } from "react";
import { Avatar, Chip, cn } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { CATEGORIES, categoryMeta } from "@/lib/places/categories";
import { priceLabel, ratingsAgreement } from "@/lib/places/links";
import type { Place, PlaceCategory } from "@/lib/types";

const CATEGORY_BG: Record<PlaceCategory, string> = {
  resto: "bg-accent-soft",
  bar: "bg-rose-soft",
  sortie: "bg-sky-soft",
  balade: "bg-sage-soft",
  weekend: "bg-sand-soft",
  activite: "bg-sand-soft",
  autre: "bg-card-2",
};

export function categoryBg(c: PlaceCategory): string {
  return CATEGORY_BG[c] ?? "bg-card-2";
}

/** Image du lieu, ou grand emoji de la catégorie si pas d'image (ou image cassée) */
export function PlaceVisual({
  place,
  className,
  emojiSize = "text-5xl",
}: {
  place: Pick<Place, "image_url" | "category" | "name">;
  className?: string;
  emojiSize?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = place.image_url && broken !== place.image_url;
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden", categoryBg(place.category), className)}>
      {showImage ? (
        <img
          src={place.image_url!}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
          onError={() => setBroken(place.image_url)}
        />
      ) : (
        <span className={emojiSize} aria-hidden>
          {categoryMeta(place.category).emoji}
        </span>
      )}
    </div>
  );
}

export function Stars({ value, size = "text-base" }: { value: number | null | undefined; size?: string }) {
  if (!value) return <span className={cn("text-muted", size)}>–</span>;
  return (
    <span className={cn("tracking-tight", size)} aria-label={`${value} sur 5`}>
      {"★".repeat(Math.round(value))}
      <span className="text-line">{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

/** Sélecteur de note 1 à 5 */
export function StarPicker({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Note">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} sur 5`}
          onClick={() => onChange(n)}
          className={cn(
            "flex size-11 items-center justify-center rounded-2xl text-2xl transition active:scale-90",
            value !== null && n <= value ? "bg-sand-soft text-sand" : "bg-card-2 text-line",
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/** Notes des parents (pastille + note) */
export function RatingsRow({ place, parentIds, compact }: { place: Place; parentIds: string[]; compact?: boolean }) {
  const { personOf, nameOf, me } = useFamily();
  const rated = parentIds.filter((id) => typeof place.ratings?.[id] === "number");
  if (rated.length === 0) return null;
  const agree = ratingsAgreement(place.ratings ?? {}, parentIds);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {rated.map((id) => (
        <span key={id} className="inline-flex items-center gap-1.5 text-sm">
          <Avatar person={personOf(id)} size={compact ? 20 : 26} />
          {!compact && <span className="text-muted">{id === me.id ? "Toi" : nameOf(id)}</span>}
          <Stars value={place.ratings[id]} size="text-sm" />
        </span>
      ))}
      {agree === "agree" && compact && <span className="text-sm">🤝</span>}
    </div>
  );
}

export function CategoryChips({
  value,
  onChange,
  withAll = true,
  className,
}: {
  value: PlaceCategory | "all";
  onChange: (v: PlaceCategory | "all") => void;
  withAll?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4", className)}>
      {withAll && (
        <Chip active={value === "all"} onClick={() => onChange("all")}>
          ✨ Tout
        </Chip>
      )}
      {CATEGORIES.filter((c) => c.value !== "autre").map((c) => (
        <Chip key={c.value} active={value === c.value} onClick={() => onChange(c.value)}>
          {c.emoji} {c.label}
        </Chip>
      ))}
      <Chip active={value === "autre"} onClick={() => onChange("autre")}>
        📍 Autres
      </Chip>
    </div>
  );
}

export function SpaceBadge({ space }: { space: Place["space"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        space === "couple" ? "bg-rose-soft text-rose" : "bg-sky-soft text-sky",
      )}
    >
      {space === "couple" ? "💑 À deux" : "👨‍👩‍👧‍👦 Famille"}
    </span>
  );
}

/** Carte d'un lieu dans la liste */
export function PlaceCard({ place, parentIds }: { place: Place; parentIds: string[] }) {
  const meta = categoryMeta(place.category);
  const price = priceLabel(place.price_level);
  return (
    <Link
      href={`/sorties/${place.id}`}
      className="flex gap-3 overflow-hidden rounded-3xl border border-line bg-card p-2 transition active:scale-[0.99]"
    >
      <PlaceVisual place={place} className="size-24 shrink-0 rounded-2xl" emojiSize="text-4xl" />
      <div className="min-w-0 flex-1 py-1 pr-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 font-bold leading-snug">{place.name}</p>
          {place.status === "done" && <span title="Testé">✅</span>}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">
          {meta.emoji} {meta.single}
          {place.city ? ` · ${place.city}` : ""}
          {price ? ` · ${price}` : ""}
          {place.space === "couple" ? " · 💑" : ""}
        </p>
        {place.tags?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {place.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-card-2 px-2 py-0.5 text-xs text-muted">
                #{t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-1.5">
          <RatingsRow place={place} parentIds={parentIds} compact />
        </div>
      </div>
    </Link>
  );
}
