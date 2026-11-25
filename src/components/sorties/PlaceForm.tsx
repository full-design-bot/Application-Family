"use client";

// Formulaire de lieu (ajout et modification).

import { MapPin, X } from "lucide-react";
import { useState } from "react";
import { Button, Field, Input, Segmented, Textarea, cn } from "@/components/ui";
import { CATEGORIES } from "@/lib/places/categories";
import { cleanInstagramHandle, parseTags } from "@/lib/places/links";
import type { PlaceDraft, PlaceSuggestion } from "@/lib/places/types";
import type { Place, PlaceCategory, Space } from "@/lib/types";

export interface PlaceFormValues {
  name: string;
  category: PlaceCategory;
  space: Space;
  address: string;
  city: string;
  url: string;
  instagram: string;
  price_level: number | null;
  tags: string;
  notes: string;
  description: string;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
}

export function valuesFromDraft(d: PlaceDraft, space: Space): PlaceFormValues {
  return {
    name: d.name ?? "",
    category: d.category,
    space,
    address: d.address ?? "",
    city: d.city ?? "",
    url: d.url ?? "",
    instagram: d.instagram ?? "",
    price_level: d.price_level,
    tags: "",
    notes: "",
    description: d.description ?? "",
    image_url: d.image_url,
    lat: d.lat,
    lng: d.lng,
  };
}

export function valuesFromPlace(p: Place): PlaceFormValues {
  return {
    name: p.name,
    category: p.category,
    space: p.space,
    address: p.address ?? "",
    city: p.city ?? "",
    url: p.url ?? "",
    instagram: p.instagram ?? "",
    price_level: p.price_level,
    tags: (p.tags ?? []).join(", "),
    notes: p.notes ?? "",
    description: p.description ?? "",
    image_url: p.image_url,
    lat: p.lat,
    lng: p.lng,
  };
}

function cleanUrl(u: string): string | null {
  const t = u.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Valeurs du formulaire → colonnes de la table places */
export function rowFromValues(v: PlaceFormValues) {
  return {
    name: v.name.trim().slice(0, 120),
    category: v.category,
    space: v.space,
    address: v.address.trim() || null,
    city: v.city.trim() || null,
    url: cleanUrl(v.url),
    instagram: cleanInstagramHandle(v.instagram),
    price_level: v.price_level,
    tags: parseTags(v.tags),
    notes: v.notes.trim() || null,
    description: v.description.trim() || null,
    image_url: v.image_url,
    lat: v.lat,
    lng: v.lng,
  };
}

export function applySuggestion(v: PlaceFormValues, s: PlaceSuggestion, overwriteName = false): PlaceFormValues {
  return {
    ...v,
    name: overwriteName || !v.name.trim() ? s.name : v.name,
    address: s.address ?? v.address,
    city: s.city ?? v.city,
    lat: s.lat,
    lng: s.lng,
    category: s.category && (overwriteName || !v.name.trim()) ? s.category : v.category,
  };
}

export function SuggestionList({
  suggestions,
  onPick,
  title,
}: {
  suggestions: PlaceSuggestion[];
  onPick: (s: PlaceSuggestion) => void;
  title?: string;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div>
      {title && <p className="mb-1.5 px-1 text-sm font-medium text-muted">{title}</p>}
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        {suggestions.map((s, i) => (
          <button
            key={`${s.name}-${s.lat}-${s.lng}`}
            type="button"
            onClick={() => onPick(s)}
            className={cn("flex w-full items-start gap-3 px-4 py-3 text-left active:bg-card-2", i > 0 && "border-t border-line")}
          >
            <MapPin className="mt-0.5 size-5 shrink-0 text-accent" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{s.name}</span>
              <span className="block truncate text-sm text-muted">{s.address ?? s.city ?? "Adresse inconnue"}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlaceForm({
  values,
  onChange,
  onSubmit,
  submitLabel,
  saving,
  canChooseSpace,
}: {
  values: PlaceFormValues;
  onChange: (v: PlaceFormValues) => void;
  onSubmit: () => void;
  submitLabel: string;
  saving?: boolean;
  canChooseSpace: boolean;
}) {
  const set = <K extends keyof PlaceFormValues>(k: K, val: PlaceFormValues[K]) => onChange({ ...values, [k]: val });
  const [showMore, setShowMore] = useState(Boolean(values.description || values.notes));
  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState<string | null>(null);

  // Cherche la position à partir de l'adresse (ou du nom) saisie
  async function locate() {
    const q = [values.address.trim() || values.name.trim(), values.city.trim()].filter(Boolean).join(" ");
    if (!q) return;
    setLocating(true);
    setLocateMsg(null);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { results?: PlaceSuggestion[] };
      const first = json.results?.[0];
      if (first) {
        onChange({
          ...values,
          lat: first.lat,
          lng: first.lng,
          address: values.address.trim() ? values.address : first.address ?? "",
          city: values.city.trim() ? values.city : first.city ?? "",
        });
      } else {
        setLocateMsg("Adresse introuvable 🤷");
      }
    } catch {
      setLocateMsg("Recherche impossible pour le moment");
    } finally {
      setLocating(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {values.image_url && (
        <div className="relative overflow-hidden rounded-3xl border border-line">
          <img src={values.image_url} alt="" referrerPolicy="no-referrer" className="h-40 w-full object-cover" />
          <button
            type="button"
            onClick={() => set("image_url", null)}
            className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-black/50 text-white"
            aria-label="Retirer l'image"
          >
            <X className="size-5" />
          </button>
        </div>
      )}

      <Field label="Nom">
        <Input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Chez Janou" required maxLength={120} />
      </Field>

      <div>
        <span className="mb-1 block px-1 text-sm font-medium text-muted">Catégorie</span>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => set("category", c.value)}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-2xl border px-1 py-2 text-xs font-semibold transition",
                values.category === c.value ? "border-accent bg-accent-soft text-accent" : "border-line bg-card text-ink",
              )}
            >
              <span className="text-xl">{c.emoji}</span>
              {c.single}
            </button>
          ))}
        </div>
      </div>

      {canChooseSpace && (
        <div>
          <span className="mb-1 block px-1 text-sm font-medium text-muted">Pour qui ?</span>
          <Segmented<Space>
            value={values.space}
            onChange={(v) => set("space", v)}
            options={[
              { value: "family", label: "👨‍👩‍👧‍👦 En famille" },
              { value: "couple", label: "💑 À deux" },
            ]}
          />
        </div>
      )}

      <Field label="Adresse">
        <Input
          value={values.address}
          onChange={(e) => onChange({ ...values, address: e.target.value, lat: null, lng: null })}
          placeholder="12 rue du Pas-Saint-Georges"
          autoComplete="off"
        />
      </Field>
      <Field label="Ville">
        <Input value={values.city} onChange={(e) => set("city", e.target.value)} placeholder="Bordeaux" autoComplete="off" />
      </Field>
      <div className="flex items-center justify-between gap-2 px-1 text-sm">
        <span className={values.lat !== null ? "text-sage" : "text-muted"}>
          {values.lat !== null ? "📍 Position trouvée sur la carte" : locateMsg ?? "Pas encore de position sur la carte"}
        </span>
        <Button type="button" size="sm" variant="secondary" loading={locating} onClick={locate} disabled={!values.address.trim() && !values.name.trim()}>
          🔎 Localiser
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Lien">
          <Input value={values.url} onChange={(e) => set("url", e.target.value)} placeholder="site, TheFork…" inputMode="url" autoCapitalize="none" />
        </Field>
        <Field label="Instagram">
          <Input
            value={values.instagram}
            onChange={(e) => set("instagram", e.target.value)}
            placeholder="@compte"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </Field>
      </div>

      <div>
        <span className="mb-1 block px-1 text-sm font-medium text-muted">Prix</span>
        <Segmented<string>
          value={String(values.price_level ?? 0)}
          onChange={(v) => set("price_level", v === "0" ? null : Number(v))}
          options={[
            { value: "0", label: "?" },
            { value: "1", label: "€" },
            { value: "2", label: "€€" },
            { value: "3", label: "€€€" },
            { value: "4", label: "€€€€" },
          ]}
        />
      </div>

      <Field label="Tags" hint="Séparés par des virgules : terrasse, brunch, enfants ok…">
        <Input value={values.tags} onChange={(e) => set("tags", e.target.value)} placeholder="terrasse, brunch" />
      </Field>

      {showMore ? (
        <>
          <Field label="Notes perso">
            <Textarea value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Conseillé par Julie, réserver le week-end…" />
          </Field>
          <Field label="Description">
            <Textarea value={values.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </>
      ) : (
        <button type="button" onClick={() => setShowMore(true)} className="px-1 text-sm font-semibold text-accent">
          + Ajouter une note ou une description
        </button>
      )}

      <Button type="submit" size="lg" className="w-full" loading={saving} disabled={!values.name.trim()}>
        {submitLabel}
      </Button>
    </form>
  );
}
