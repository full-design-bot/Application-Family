"use client";

import { Heart, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CategoryChips, PlaceVisual } from "@/components/sorties/PlaceBits";
import { SPACE_OPTIONS, dailyShuffle, filterBySpace, useParentIds, usePlaces, type SpaceFilter } from "@/components/sorties/data";
import { Avatar, Button, Card, EmptyState, LinkButton, LoadingBlock, PageHeader, SectionTitle, Segmented, Sheet, cn, useToast } from "@/components/ui";
import { todayISO } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import { categoryMeta } from "@/lib/places/categories";
import { agendaUrl, priceLabel } from "@/lib/places/links";
import { notify } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";
import type { Place, PlaceCategory, PlaceSwipe } from "@/lib/types";

const SWIPE_THRESHOLD = 90;

export default function CeSoirPage() {
  const toast = useToast();
  const { me, partner, isParent, personOf } = useFamily();
  const parentIds = useParentIds();
  const { places, loading: loadingPlaces } = usePlaces();
  const [today] = useState(() => todayISO());
  const [swipes, setSwipes] = useState<PlaceSwipe[]>([]);
  const [loadingSwipes, setLoadingSwipes] = useState(true);
  const [space, setSpace] = useState<SpaceFilter>("all");
  const [category, setCategory] = useState<PlaceCategory | "all">("all");
  const [matchPlace, setMatchPlace] = useState<Place | null>(null);
  const [drawn, setDrawn] = useState<Place | null>(null);
  const knownMatches = useRef<Set<string> | null>(null);

  // ------------------------------------------------ swipes du jour (temps réel)
  const loadSwipes = useCallback(async () => {
    const { data } = await supabase().from("place_swipes").select("*").eq("session_date", today);
    setSwipes((data ?? []) as PlaceSwipe[]);
    setLoadingSwipes(false);
  }, [today]);

  useEffect(() => {
    loadSwipes();
    const sb = supabase();
    const ch = sb
      .channel(`sorties-swipes-${today}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "place_swipes", filter: `session_date=eq.${today}` }, () => loadSwipes())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [loadSwipes, today]);

  // ------------------------------------------------ données dérivées
  const todo = useMemo(() => places.filter((p) => p.status === "todo"), [places]);
  const candidates = useMemo(
    () => filterBySpace(todo, space).filter((p) => category === "all" || p.category === category),
    [todo, space, category],
  );
  const mine = useMemo(() => new Map(swipes.filter((s) => s.member_id === me.id).map((s) => [s.place_id, s.liked])), [swipes, me.id]);
  const partnerLikes = useMemo(
    () => new Set(swipes.filter((s) => partner && s.member_id === partner.id && s.liked).map((s) => s.place_id)),
    [swipes, partner],
  );
  const partnerCount = useMemo(() => swipes.filter((s) => partner && s.member_id === partner.id).length, [swipes, partner]);
  const deck = useMemo(() => dailyShuffle(candidates.filter((p) => !mine.has(p.id)), today), [candidates, mine, today]);

  const matches = useMemo(() => {
    if (parentIds.length < 2) return [];
    return todo.filter((p) => parentIds.every((id) => swipes.some((s) => s.place_id === p.id && s.member_id === id && s.liked)));
  }, [todo, swipes, parentIds]);

  // Nouveau match (le mien ou arrivé en direct) → écran « C'est un match ! »
  useEffect(() => {
    if (loadingSwipes || loadingPlaces) return;
    const ids = new Set(matches.map((m) => m.id));
    if (knownMatches.current) {
      const fresh = matches.find((m) => !knownMatches.current!.has(m.id));
      if (fresh) setMatchPlace(fresh);
    }
    knownMatches.current = ids;
  }, [matches, loadingSwipes, loadingPlaces]);

  // ------------------------------------------------ actions
  async function swipe(place: Place, liked: boolean) {
    const row: PlaceSwipe = { session_date: today, place_id: place.id, member_id: me.id, liked, created_at: new Date().toISOString() };
    setSwipes((list) => [...list.filter((s) => !(s.place_id === place.id && s.member_id === me.id)), row]);
    const { error } = await supabase()
      .from("place_swipes")
      .upsert({ session_date: today, place_id: place.id, member_id: me.id, liked }, { onConflict: "session_date,place_id,member_id" });
    if (error) {
      toast("Oups, ton choix n'a pas été enregistré.", "error");
      loadSwipes();
      return;
    }
    if (liked && partnerLikes.has(place.id)) {
      notify({
        title: "🎉 C'est un match !",
        body: `Vous avez tous les deux envie de ${categoryMeta(place.category).emoji} ${place.name} ce soir`,
        url: "/sorties/ce-soir",
        tag: `sortie-match-${today}`,
      });
    }
  }

  async function resetMine() {
    if (!confirm("Effacer tes choix d'aujourd'hui et tout recommencer ?")) return;
    await supabase().from("place_swipes").delete().eq("session_date", today).eq("member_id", me.id);
    loadSwipes();
  }

  function draw() {
    const pool = matches.length > 0 ? matches : candidates;
    if (pool.length === 0) {
      toast("Aucune idée à tirer au sort 🤷");
      return;
    }
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && drawn && pick.id === drawn.id) pick = pool.find((p) => p.id !== drawn.id) ?? pick;
    setDrawn(pick);
  }

  // ------------------------------------------------ rendu
  if (!isParent) {
    return (
      <>
        <PageHeader title="On sort où ce soir ?" back="/sorties" />
        <EmptyState emoji="🎲" title="Ce jeu est pour les parents" />
      </>
    );
  }

  const loading = loadingPlaces || loadingSwipes;

  return (
    <>
      <PageHeader title="On sort où ce soir ? 🎲" subtitle="Chacun choisit, on garde ce qui plaît aux deux" back="/sorties" />

      <div className="space-y-3">
        <Segmented<SpaceFilter> value={space} onChange={setSpace} options={SPACE_OPTIONS} />
        <CategoryChips value={category} onChange={setCategory} />
      </div>

      {!partner && (
        <p className="mt-3 rounded-2xl bg-sand-soft px-4 py-3 text-sm">
          ℹ️ L&apos;autre parent ne s&apos;est pas encore connecté : pas de match possible pour l&apos;instant, mais tu peux déjà choisir.
        </p>
      )}
      {partner && (
        <p className="mt-3 flex items-center gap-2 px-1 text-sm text-muted">
          <Avatar person={personOf(partner.id)} size={22} />
          {partnerCount === 0 ? `${partner.display_name} n'a pas encore joué aujourd'hui` : `${partner.display_name} a déjà donné son avis sur ${partnerCount} lieu${partnerCount > 1 ? "x" : ""}`}
        </p>
      )}

      <div className="mt-4">
        {loading ? (
          <LoadingBlock />
        ) : todo.length === 0 ? (
          <EmptyState
            emoji="🍽️"
            title="Aucune idée « à tester »"
            text="Ajoute d'abord quelques restos ou sorties."
            action={<LinkButton href="/sorties/ajouter">➕ Ajouter</LinkButton>}
          />
        ) : deck.length === 0 ? (
          <Card className="py-8 text-center">
            <p className="text-4xl">🏁</p>
            <p className="mt-2 font-semibold">{candidates.length === 0 ? "Aucun lieu avec ces filtres" : "Tu as tout vu !"}</p>
            <p className="mt-1 text-sm text-muted">
              {matches.length > 0
                ? "Regarde vos matchs ci-dessous 👇"
                : partner && partnerCount === 0
                  ? `On attend les choix de ${partner.display_name}…`
                  : "Pas encore de match. Tire au sort, ou recommence !"}
            </p>
          </Card>
        ) : (
          <SwipeDeck deck={deck} onSwipe={swipe} />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={draw} disabled={loading}>
          🎲 Tirer au sort
        </Button>
        <Button variant="secondary" onClick={resetMine} disabled={loading || mine.size === 0}>
          <RotateCcw className="size-4" /> Recommencer
        </Button>
      </div>
      <p className="mt-1 px-1 text-center text-xs text-muted">
        {matches.length > 0 ? "Le tirage se fait parmi vos matchs du jour" : "Pas de match : le tirage se fait parmi toutes les idées filtrées"}
      </p>

      <SectionTitle>💞 Matchs du jour ({matches.length})</SectionTitle>
      {matches.length === 0 ? (
        <p className="px-1 text-sm text-muted">Quand vous aimez tous les deux un lieu, il apparaît ici.</p>
      ) : (
        <div className="space-y-2">
          {matches.map((p) => (
            <Link key={p.id} href={`/sorties/${p.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-2 active:bg-card-2">
              <PlaceVisual place={p} className="size-14 shrink-0 rounded-xl" emojiSize="text-2xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="truncate text-sm text-muted">
                  {categoryMeta(p.category).emoji} {categoryMeta(p.category).single}
                  {p.city ? ` · ${p.city}` : ""}
                </p>
              </div>
              <span className="pr-2 text-xl">💞</span>
            </Link>
          ))}
        </div>
      )}

      {/* Écran de match */}
      {matchPlace && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 px-6 text-center backdrop-blur" role="dialog" aria-modal="true">
          <p className="animate-pop text-6xl">🎉</p>
          <h2 className="mt-3 text-3xl font-bold">C&apos;est un match !</h2>
          <p className="mt-1 text-muted">Vous avez tous les deux envie de…</p>
          <div className="mt-5 w-full max-w-xs overflow-hidden rounded-3xl border border-line bg-card">
            <PlaceVisual place={matchPlace} className="h-40" emojiSize="text-6xl" />
            <div className="p-4">
              <p className="text-xl font-bold">{matchPlace.name}</p>
              {matchPlace.city && <p className="text-sm text-muted">{matchPlace.city}</p>}
            </div>
          </div>
          <div className="mt-6 grid w-full max-w-xs gap-2">
            <LinkButton href={agendaUrl(matchPlace)}>📅 On y va</LinkButton>
            <LinkButton href={`/sorties/${matchPlace.id}`} variant="secondary">
              Voir la fiche
            </LinkButton>
            <Button variant="ghost" onClick={() => setMatchPlace(null)}>
              Continuer à choisir
            </Button>
          </div>
        </div>
      )}

      {/* Tirage au sort */}
      <Sheet open={drawn !== null} onClose={() => setDrawn(null)} title="Le sort a parlé ! 🎲">
        {drawn && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-line bg-card">
              <PlaceVisual place={drawn} className="h-44" emojiSize="text-6xl" />
              <div className="p-4">
                <p className="text-xl font-bold">{drawn.name}</p>
                <p className="text-sm text-muted">
                  {categoryMeta(drawn.category).emoji} {categoryMeta(drawn.category).single}
                  {drawn.city ? ` · ${drawn.city}` : ""}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LinkButton href={agendaUrl(drawn)}>📅 On y va</LinkButton>
              <LinkButton href={`/sorties/${drawn.id}`} variant="secondary">
                Voir la fiche
              </LinkButton>
            </div>
            <Button variant="ghost" className="w-full" onClick={draw}>
              🔄 Relancer
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------- Cartes à balayer

function SwipeDeck({ deck, onSwipe }: { deck: Place[]; onSwipe: (p: Place, liked: boolean) => void }) {
  const top = deck[0];
  const next = deck[1];
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<{ id: string; liked: boolean } | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);

  const commit = useCallback(
    (liked: boolean) => {
      if (!top || leaving) return;
      setLeaving({ id: top.id, liked });
      setTimeout(() => {
        onSwipe(top, liked);
        setLeaving(null);
        setDx(0);
      }, 220);
    },
    [top, leaving, onSwipe],
  );

  if (!top) return null;
  const offset = leaving?.id === top.id ? (leaving.liked ? 520 : -520) : dx;
  const meta = categoryMeta(top.category);
  const price = priceLabel(top.price_level);

  return (
    <div>
      <div className="relative h-[420px]">
        {next && (
          <div className="absolute inset-0 scale-[0.95] overflow-hidden rounded-3xl border border-line bg-card opacity-70">
            <PlaceVisual place={next} className="h-60" emojiSize="text-6xl" />
          </div>
        )}
        <div
          key={top.id}
          className={cn(
            "absolute inset-0 cursor-grab touch-pan-y select-none overflow-hidden rounded-3xl border border-line bg-card shadow-lg",
            !dragging && "transition-transform duration-200",
          )}
          style={{ transform: `translateX(${offset}px) rotate(${offset / 18}deg)` }}
          onPointerDown={(e) => {
            start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (!start.current || start.current.id !== e.pointerId) return;
            const mx = e.clientX - start.current.x;
            const my = e.clientY - start.current.y;
            // Geste surtout vertical : on laisse défiler la page
            if (Math.abs(my) > Math.abs(mx) * 1.5 && Math.abs(mx) < 20) return;
            if (Math.abs(mx) > 8) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setDx(mx);
          }}
          onPointerUp={() => {
            start.current = null;
            setDragging(false);
            if (dx > SWIPE_THRESHOLD) commit(true);
            else if (dx < -SWIPE_THRESHOLD) commit(false);
            else setDx(0);
          }}
          onPointerCancel={() => {
            start.current = null;
            setDragging(false);
            setDx(0);
          }}
        >
          <PlaceVisual place={top} className="pointer-events-none h-60" emojiSize="text-7xl" />
          {/* Tampons J'aime / Bof */}
          <span
            className="pointer-events-none absolute left-4 top-4 rotate-[-12deg] rounded-xl border-4 border-sage px-3 py-1 text-2xl font-black text-sage"
            style={{ opacity: Math.max(0, Math.min(1, offset / SWIPE_THRESHOLD)) }}
          >
            ENVIE ❤️
          </span>
          <span
            className="pointer-events-none absolute right-4 top-4 rotate-[12deg] rounded-xl border-4 border-danger px-3 py-1 text-2xl font-black text-danger"
            style={{ opacity: Math.max(0, Math.min(1, -offset / SWIPE_THRESHOLD)) }}
          >
            BOF ✖️
          </span>
          <div className="p-4">
            <p className="text-2xl font-bold leading-tight">{top.name}</p>
            <p className="mt-1 text-muted">
              {meta.emoji} {meta.single}
              {top.city ? ` · ${top.city}` : ""}
              {price ? ` · ${price}` : ""}
              {top.space === "couple" ? " · 💑" : ""}
            </p>
            {top.tags?.length > 0 && <p className="mt-1 truncate text-sm text-muted">{top.tags.map((t) => `#${t}`).join(" ")}</p>}
            {(top.notes || top.description) && <p className="mt-2 line-clamp-2 text-sm">{top.notes ?? top.description}</p>}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => commit(false)}
          aria-label="Bof"
          className="flex size-16 items-center justify-center rounded-full border border-line bg-card text-danger shadow-md transition active:scale-90"
        >
          <X className="size-8" strokeWidth={3} />
        </button>
        <span className="text-sm text-muted">{deck.length} à voir</span>
        <button
          type="button"
          onClick={() => commit(true)}
          aria-label="J'ai envie"
          className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-ink shadow-md transition active:scale-90"
        >
          <Heart className="size-8" fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
