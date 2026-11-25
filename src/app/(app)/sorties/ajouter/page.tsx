"use client";

import { ClipboardPaste, Link2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  PlaceForm,
  SuggestionList,
  applySuggestion,
  rowFromValues,
  valuesFromDraft,
  type PlaceFormValues,
} from "@/components/sorties/PlaceForm";
import { Button, Card, LoadingBlock, PageHeader, Spinner, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { categoryEmoji } from "@/lib/places/categories";
import { cleanInstagramHandle } from "@/lib/places/links";
import { classifyInput, extractFirstUrl } from "@/lib/places/input";
import { emptyDraft, type PlaceSuggestion, type PreviewResponse } from "@/lib/places/types";
import { notify } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";
import type { Place, Space } from "@/lib/types";

export default function AjouterPage() {
  return (
    <>
      <PageHeader title="Nouvelle idée ✨" back="/sorties" />
      <Suspense fallback={<LoadingBlock />}>
        <AddPlace />
      </Suspense>
    </>
  );
}

const DEFAULT_SPACE: Space = "family";

const KIND_LABEL: Record<string, string> = {
  gmaps: "🗺️ Lien Google Maps",
  instagram: "📸 Instagram",
  url: "🔗 Site web",
  text: "✍️ Nom",
};

function AddPlace() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { me, isParent } = useFamily();

  const [query, setQuery] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [values, setValues] = useState<PlaceFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<Pick<Place, "id" | "name"> | null>(null);
  const lastAnalyzed = useRef<string>("");
  const searchSeq = useRef(0);
  const autoStarted = useRef(false);

  const kind = classifyInput(query).kind;
  const isLinkLike = kind === "gmaps" || kind === "instagram" || kind === "url";

  // ------------------------------------------------ analyse d'un lien / @compte
  const analyze = useCallback(
    async (input: string, hints?: { title?: string | null; text?: string | null }) => {
      const trimmed = input.trim();
      if (!trimmed) return;
      lastAnalyzed.current = trimmed;
      setAnalyzing(true);
      setResults([]);
      try {
        const res = await fetch("/api/places/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: trimmed, title: hints?.title ?? undefined, text: hints?.text ?? undefined }),
        });
        const json = await res.json();
        if (lastAnalyzed.current !== trimmed) return; // une saisie plus récente a pris le relais
        if (!res.ok) throw new Error(json.error ?? "Analyse impossible");
        const data = json as PreviewResponse;
        setPreview(data);
        // Pour un simple nom, le formulaire est déjà ouvert : on ne remplace pas ce qui a pu être saisi
        setValues((prev) => (prev && data.kind === "text" ? prev : valuesFromDraft(data.draft, DEFAULT_SPACE)));
      } catch (e) {
        if (lastAnalyzed.current !== trimmed) return;
        toast(e instanceof Error ? e.message : "Analyse impossible", "error");
        // On propose quand même le formulaire, prérempli avec ce qu'on sait
        const d = emptyDraft();
        d.url = extractFirstUrl(trimmed);
        d.name = hints?.title ?? null;
        setPreview({ kind: "url", draft: d, suggestions: [], warning: "Analyse impossible : complète à la main." });
        setValues(valuesFromDraft(d, DEFAULT_SPACE));
      } finally {
        if (lastAnalyzed.current === trimmed) setAnalyzing(false);
      }
    },
    [toast],
  );

  // ------------------------------------------------ paramètres du Raccourci iOS : ?url=…&text=…&title=…
  useEffect(() => {
    if (autoStarted.current) return;
    const url = params.get("url");
    const text = params.get("text");
    const title = params.get("title");
    const input = url || (text && extractFirstUrl(text)) || text || title;
    if (!input) return;
    autoStarted.current = true;
    setQuery(input);
    const c = classifyInput(input);
    if (c.kind === "text") {
      // Juste un nom : on le cherche et on ouvre le formulaire directement
      setValues(valuesFromDraft({ ...emptyDraft(), name: c.text }, DEFAULT_SPACE));
      setPreview({ kind: "text", draft: { ...emptyDraft(), name: c.text }, suggestions: [], warning: null });
      analyze(input, { title, text });
    } else {
      analyze(input, { title, text: url ? text : null });
    }
  }, [params, analyze]);

  // ------------------------------------------------ saisie : lien → analyse auto, texte → suggestions
  useEffect(() => {
    if (values) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    if (isLinkLike) {
      if (q === lastAnalyzed.current) return;
      const t = setTimeout(() => analyze(q), 350);
      return () => clearTimeout(t);
    }
    if (q.length < 3) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as { results?: PlaceSuggestion[] };
        if (seq === searchSeq.current) setResults(json.results ?? []);
      } catch {
        if (seq === searchSeq.current) setResults([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [query, isLinkLike, analyze, values]);

  // ------------------------------------------------ doublon ?
  useEffect(() => {
    const name = values?.name.trim();
    if (!name || name.length < 3) {
      setDuplicate(null);
      return;
    }
    const insta = cleanInstagramHandle(values?.instagram);
    const t = setTimeout(async () => {
      const sb = supabase();
      const [byName, byInsta] = await Promise.all([
        sb.from("places").select("id, name").ilike("name", name.replace(/[\\%_]/g, "")).limit(1),
        insta ? sb.from("places").select("id, name").eq("instagram", insta).limit(1) : Promise.resolve({ data: [] }),
      ]);
      const found = (byName.data?.[0] ?? byInsta.data?.[0]) as Pick<Place, "id" | "name"> | undefined;
      setDuplicate(found ?? null);
    }, 500);
    return () => clearTimeout(t);
  }, [values?.name, values?.instagram]);

  function pickResult(s: PlaceSuggestion) {
    setValues(applySuggestion(valuesFromDraft(emptyDraft(), DEFAULT_SPACE), s, true));
    setPreview({ kind: "text", draft: emptyDraft(), suggestions: [], warning: null });
  }

  function addNameAsIs() {
    const name = query.trim();
    setValues(valuesFromDraft({ ...emptyDraft(), name }, DEFAULT_SPACE));
    setPreview({ kind: "text", draft: { ...emptyDraft(), name }, suggestions: results, warning: null });
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setQuery(text.trim());
    } catch {
      toast("Appuie longuement dans le champ puis « Coller » 😉");
    }
  }

  function reset() {
    setValues(null);
    setPreview(null);
    setResults([]);
    setQuery("");
    setAnalyzing(false);
    lastAnalyzed.current = "";
  }

  async function save() {
    if (!values?.name.trim()) return;
    setSaving(true);
    const row = { ...rowFromValues(values), added_by: me.id, status: "todo" as const };
    const { data, error } = await supabase().from("places").insert(row).select("id").single();
    setSaving(false);
    if (error || !data) {
      toast("Oups, l'enregistrement a échoué. Réessaie.", "error");
      return;
    }
    toast("Idée enregistrée 📍", "success");
    notify({
      title: `📍 Nouvelle idée : ${row.name}`,
      body: `${me.display_name} a ajouté ${categoryEmoji(row.category)} ${row.name}${row.city ? ` (${row.city})` : ""}${row.space === "couple" ? " — pour vous deux 💑" : ""}`,
      url: `/sorties/${data.id}`,
      tag: `sortie-${data.id}`,
    });
    router.replace(`/sorties/${data.id}`);
  }

  // ------------------------------------------------ rendu
  if (values) {
    const suggestions = preview?.suggestions ?? [];
    return (
      <div className="space-y-4">
        <Card className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{KIND_LABEL[preview?.kind ?? "text"] ?? "Nouvelle idée"}</p>
            <p className="truncate text-sm">{query || values.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            Changer
          </Button>
        </Card>

        {analyzing && (
          <div className="flex items-center gap-2 px-1 text-sm text-muted">
            <Spinner className="size-4" /> Je regarde ce lien…
          </div>
        )}
        {preview?.warning && <p className="rounded-2xl bg-sand-soft px-4 py-3 text-sm">⚠️ {preview.warning}</p>}
        {duplicate && (
          <Link href={`/sorties/${duplicate.id}`} className="block rounded-2xl bg-rose-soft px-4 py-3 text-sm">
            👀 <b>{duplicate.name}</b> est déjà dans vos idées. <span className="font-semibold text-accent">Voir la fiche</span>
          </Link>
        )}

        {values.lat === null && suggestions.length > 0 && (
          <SuggestionList
            title="📍 C'est l'un de ces lieux ? (pour l'adresse et la carte)"
            suggestions={suggestions}
            onPick={(s) => {
              setValues((v) => (v ? applySuggestion(v, s) : v));
              setPreview((p) => (p ? { ...p, suggestions: [] } : p));
            }}
          />
        )}

        <PlaceForm
          values={values}
          onChange={setValues}
          onSubmit={save}
          saving={saving}
          submitLabel="📍 Enregistrer l'idée"
          canChooseSpace={isParent}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Link2 className="pointer-events-none absolute left-4 top-4 size-5 text-muted" />
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Colle un lien, un @instagram ou tape un nom"
          rows={2}
          autoFocus
          autoCapitalize="sentences"
          className="min-h-20 w-full resize-none rounded-3xl border border-line bg-card py-3.5 pl-11 pr-4 text-ink outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {!query && (
        <>
          <Button variant="soft" className="w-full" onClick={pasteFromClipboard}>
            <ClipboardPaste className="size-5" /> Coller depuis le presse-papiers
          </Button>
          <Card className="space-y-2 text-sm">
            <p className="font-semibold">Ça marche avec :</p>
            <p>🗺️ un lien Google Maps (Partager → Copier le lien)</p>
            <p>📸 un compte ou une publication Instagram, ou juste <b>@chezjanou</b></p>
            <p>🔗 le site du resto, TheFork, TripAdvisor…</p>
            <p>✍️ ou simplement le nom : « Le Petit Commerce »</p>
          </Card>
          <Link href="/sorties/raccourci" className="block rounded-3xl bg-sky-soft p-4 text-sm active:scale-[0.99]">
            📲 <b>Astuce :</b> ajoute directement depuis Safari, Instagram ou Google Maps avec le bouton Partager → crée le raccourci « Ajouter à Noesia ».
          </Link>
        </>
      )}

      {analyzing && (
        <div className="flex flex-col items-center gap-2 py-8 text-muted">
          <Spinner />
          <p>Je regarde ce que c&apos;est…</p>
        </div>
      )}

      {!isLinkLike && query.trim().length >= 2 && (
        <div className="space-y-3">
          <Button variant="secondary" className="w-full justify-start" onClick={addNameAsIs}>
            ✍️ Ajouter « {query.trim()} »
          </Button>
          {searching && results.length === 0 ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : (
            <SuggestionList title="Ou choisis un lieu trouvé sur la carte :" suggestions={results} onPick={pickResult} />
          )}
        </div>
      )}
    </div>
  );
}
