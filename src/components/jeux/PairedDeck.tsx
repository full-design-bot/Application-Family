"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, LoadingBlock, Segmented, cn, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { hashSeed, seededRng, shuffle } from "@/lib/jeux/random";
import { notify } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";
import type { PairedAnswer } from "@/lib/types";
import { errorText, fetchPartnerKeys, randomId } from "./data";

export interface FormProps<T> {
  item: T;
  busy: boolean;
  onSubmit: (answer: unknown, guess?: unknown) => void;
}

export interface RevealProps<T> {
  item: T;
  mine: PairedAnswer;
  theirs: PairedAnswer | null;
}

/**
 * Jeu « révélé à deux » (paired_answers) : je réponds, puis je vois la réponse
 * de l'autre (la base ne me la montre qu'après avoir répondu).
 */
export function PairedDeck<T extends { key: string }>({
  game,
  label,
  items,
  ordered,
  url,
  discreet,
  Prompt,
  Form,
  Reveal,
}: {
  game: string;
  /** nom du jeu pour les notifications */
  label: string;
  items: readonly T[];
  /** garder l'ordre du contenu (sinon ordre mélangé, identique pour les deux) */
  ordered?: boolean;
  url: string;
  discreet?: boolean;
  Prompt: React.ComponentType<{ item: T }>;
  Form: React.ComponentType<FormProps<T>>;
  Reveal: React.ComponentType<RevealProps<T>>;
}) {
  const { me, partner } = useFamily();
  const toast = useToast();
  const [rows, setRows] = useState<PairedAnswer[]>([]);
  const [partnerKeys, setPartnerKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"jouer" | "historique">("jouer");
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [justAnswered, setJustAnswered] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data }, keys] = await Promise.all([
      supabase().from("paired_answers").select("*").eq("game", game),
      fetchPartnerKeys(game),
    ]);
    setRows((data ?? []) as PairedAnswer[]);
    setPartnerKeys(new Set(keys.map((k) => k.item_key)));
    setLoading(false);
  }, [game]);

  useEffect(() => {
    load();
    const sb = supabase();
    const ch = sb
      .channel(`jeux-paires-${game}-${randomId()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "paired_answers", filter: `game=eq.${game}` }, () => load())
      .subscribe();
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sb.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, game]);

  // Ouverture depuis une notification : /jeux/devine?q=devine-012
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setCurrentKey(q);
  }, []);

  const mine = useMemo(() => new Map(rows.filter((r) => r.member_id === me.id).map((r) => [r.item_key, r])), [rows, me.id]);
  const theirs = useMemo(() => new Map(rows.filter((r) => r.member_id !== me.id).map((r) => [r.item_key, r])), [rows, me.id]);

  const order = useMemo(() => {
    if (ordered) return [...items];
    const seed = hashSeed(`${game}:${[me.id, partner?.id ?? ""].sort().join(":")}`);
    return shuffle(items, seededRng(seed));
  }, [items, ordered, game, me.id, partner?.id]);

  const queue = useMemo(() => {
    const todo = order.filter((i) => !mine.has(i.key));
    // d'abord celles auxquelles l'autre a déjà répondu
    return [...todo.filter((i) => partnerKeys.has(i.key)), ...todo.filter((i) => !partnerKeys.has(i.key))];
  }, [order, mine, partnerKeys]);

  const showing = justAnswered ?? currentKey;
  const current = (showing ? items.find((i) => i.key === showing) : undefined) ?? queue[0];

  async function submit(answer: unknown, guess?: unknown) {
    if (!current || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase()
        .from("paired_answers")
        .insert({ game, item_key: current.key, member_id: me.id, answer, guess: guess ?? null });
      if (error) throw error;
      const hadPartner = partnerKeys.has(current.key);
      await load();
      setJustAnswered(current.key);
      setCurrentKey(null);
      const link = `${url}?q=${encodeURIComponent(current.key)}`;
      if (discreet) {
        void notify({ title: label, discreet: true, url: link });
      } else if (hadPartner) {
        void notify({ title: `💡 ${me.display_name} a répondu aussi !`, body: `${label} : venez comparer vos réponses 👀`, url: link, tag: `jeux-${game}` });
      } else {
        void notify({ title: `💡 ${me.display_name} a répondu à une question, à toi !`, body: label, url: link, tag: `jeux-${game}` });
      }
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;

  const answeredCount = mine.size;
  const history = [...mine.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-card-2">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(answeredCount / Math.max(1, items.length)) * 100}%` }} />
        </div>
        <span className="text-sm tabular-nums text-muted">
          {answeredCount}/{items.length}
        </span>
      </div>
      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "jouer", label: "Jouer" },
          { value: "historique", label: `Nos réponses (${answeredCount})` },
        ]}
      />

      {tab === "jouer" ? (
        !current ? (
          <EmptyState emoji="🎉" title="Tu as tout répondu !" text="Bravo, il ne reste plus rien à découvrir ici… pour l'instant." />
        ) : mine.has(current.key) ? (
          <div className="space-y-3">
            <Card className="space-y-3">
              <Prompt item={current} />
              <Reveal item={current} mine={mine.get(current.key)!} theirs={theirs.get(current.key) ?? null} />
            </Card>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                setJustAnswered(null);
                setCurrentKey(null);
              }}
              disabled={queue.length === 0}
            >
              {queue.length === 0 ? "C'était la dernière 🎉" : "Question suivante →"}
            </Button>
          </div>
        ) : (
          <Card className="animate-pop space-y-4" key={current.key}>
            {partnerKeys.has(current.key) && (
              <p className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                <CheckCircle2 className="size-3.5" /> {partner?.display_name ?? "L'autre"} a déjà répondu
              </p>
            )}
            <Prompt item={current} />
            <Form item={current} busy={busy} onSubmit={submit} />
          </Card>
        )
      ) : history.length === 0 ? (
        <EmptyState emoji="📝" title="Pas encore de réponse" text="Réponds à ta première question !" />
      ) : (
        <div className="space-y-3">
          {history.map((r) => {
            const item = items.find((i) => i.key === r.item_key);
            if (!item) return null;
            const t = theirs.get(r.item_key) ?? null;
            return (
              <Card key={r.id} className={cn("space-y-3", !t && "opacity-90")}>
                <Prompt item={item} />
                <Reveal item={item} mine={r} theirs={t} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Pastille « en attente de l'autre ». */
export function WaitingPartner() {
  const { partner } = useFamily();
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-card-2 px-3 py-2 text-sm text-muted">
      <Clock className="size-4" /> En attente de la réponse de {partner?.display_name ?? "l'autre"}… Tu seras prévenu·e !
    </p>
  );
}
