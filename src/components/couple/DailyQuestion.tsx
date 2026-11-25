"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Spinner, Textarea, cn, useToast } from "@/components/ui";
import { THEME_LABELS, questionForDate } from "@/content/questions-du-jour";
import { formatDayLong, todayISO } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import { supabase } from "@/lib/supabase/client";
import type { PairedAnswer } from "@/lib/types";
import { answerText, useDailyQuestion, type DailyAnswer } from "./hooks";

function ThemeChip({ theme }: { theme: keyof typeof THEME_LABELS }) {
  const t = THEME_LABELS[theme];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-card-2 px-2.5 py-0.5 text-xs font-semibold text-muted">
      {t.emoji} {t.label}
    </span>
  );
}

/**
 * Aperçu de la question du jour et de l'état des réponses (pour l'accueil).
 * Au toucher → /nous-deux. Autonome : charge ses propres données.
 */
export function DailyQuestionCard({ className, href = "/nous-deux#question" }: { className?: string; href?: string }) {
  const { partner, isParent } = useFamily();
  const { question, mine, theirs, partnerAnswered, loading } = useDailyQuestion();
  if (!isParent) return null;
  const name = partner?.display_name ?? "l'autre";

  let status: string;
  if (!mine) status = partnerAnswered ? `${name} a répondu — réponds pour découvrir ! 👀` : `Réponds pour découvrir la réponse de ${name}`;
  else if (theirs) status = "Vous avez répondu tous les deux 💛 Découvre sa réponse";
  else status = `Tu as répondu ✓ — en attente de ${name}`;

  return (
    <Link href={href} className={cn("block rounded-3xl bg-sand-soft p-4 transition active:scale-[0.99]", className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted">❓ Question du jour</p>
        <ThemeChip theme={question.theme} />
      </div>
      <p className="font-display text-lg font-bold leading-snug">{question.text}</p>
      <p className="mt-2 text-sm text-muted">{loading ? "…" : status}</p>
    </Link>
  );
}

/** Question du jour complète : réponse, puis révélation des deux réponses. */
export function DailyQuestionPanel() {
  const { partner } = useFamily();
  const toast = useToast();
  const { question, mine, theirs, partnerAnswered, loading, submit } = useDailyQuestion();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const name = partner?.display_name ?? "l'autre";

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await submit(text);
      setJustRevealed(true);
      setEditing(false);
      setText("");
    } catch {
      toast("Réponse non enregistrée 😕", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-3xl bg-sand-soft p-4">
      <div className="mb-2 flex items-center justify-between">
        <ThemeChip theme={question.theme} />
        <span className="text-xs text-muted">{formatDayLong(todayISO())}</span>
      </div>
      <p className="font-display text-xl font-bold leading-snug">{question.text}</p>

      {loading ? (
        <div className="py-4">
          <Spinner />
        </div>
      ) : !mine || editing ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ta réponse, en toute sincérité…"
            maxLength={1000}
            className="bg-card"
          />
          <Button className="w-full" loading={sending} disabled={!text.trim()} onClick={send}>
            {editing ? "Modifier ma réponse" : "Répondre"}
          </Button>
          {!editing && (
            <p className="text-center text-sm text-muted">
              {partnerAnswered ? `🤫 ${name} a déjà répondu… réponds pour découvrir !` : `Réponds pour découvrir la réponse de ${name}`}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <AnswerBubble who="Toi" text={answerText(mine)} mine animate={justRevealed} />
          {theirs ? (
            <AnswerBubble who={name} text={answerText(theirs)} animate={justRevealed} delay />
          ) : (
            <p className="rounded-2xl bg-card/60 px-4 py-3 text-sm text-muted">
              ⏳ {name} n&apos;a pas encore répondu. Tu recevras la révélation dès que c&apos;est fait.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setText(answerText(mine));
              setEditing(true);
            }}
            className="px-1 text-sm text-muted underline-offset-2 active:underline"
          >
            Modifier ma réponse
          </button>
        </div>
      )}
    </div>
  );
}

function AnswerBubble({ who, text, mine, animate, delay }: { who: string; text: string; mine?: boolean; animate?: boolean; delay?: boolean }) {
  return (
    <div
      className={cn("rounded-2xl px-4 py-3", mine ? "bg-card" : "bg-rose-soft", animate && "animate-pop")}
      style={animate && delay ? { animationDelay: "350ms" } : undefined}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{who}</p>
      <p className="whitespace-pre-wrap break-words">{text}</p>
    </div>
  );
}

/** Historique des questions passées (les jours où j'ai répondu). */
export function DailyHistory() {
  const { me, partner } = useFamily();
  const [items, setItems] = useState<{ date: string; question: string; mine?: PairedAnswer; theirs?: PairedAnswer }[] | null>(null);
  const [limit, setLimit] = useState(10);
  const name = partner?.display_name ?? "l'autre";

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase()
        .from("paired_answers")
        .select("*")
        .eq("game", "daily")
        .lt("item_key", todayISO())
        .order("item_key", { ascending: false })
        .limit(200);
      if (!alive) return;
      const byDate = new Map<string, { date: string; question: string; mine?: PairedAnswer; theirs?: PairedAnswer }>();
      for (const a of (data ?? []) as PairedAnswer[]) {
        const entry = byDate.get(a.item_key) ?? {
          date: a.item_key,
          question: (a.answer as DailyAnswer | null)?.question ?? questionForDate(a.item_key).text,
        };
        if (a.member_id === me.id) entry.mine = a;
        else entry.theirs = a;
        byDate.set(a.item_key, entry);
      }
      setItems([...byDate.values()].filter((e) => e.mine));
    })();
    return () => {
      alive = false;
    };
  }, [me.id]);

  if (items === null) return <Spinner />;
  if (!items.length) return <p className="px-1 text-sm text-muted">Vos réponses des jours passés apparaîtront ici.</p>;

  return (
    <div className="space-y-2">
      {items.slice(0, limit).map((e) => (
        <details key={e.date} className="group rounded-3xl border border-line bg-card p-4">
          <summary className="cursor-pointer list-none">
            <p className="text-xs text-muted">{formatDayLong(e.date)}</p>
            <p className="font-semibold leading-snug">{e.question}</p>
          </summary>
          <div className="mt-3 space-y-2">
            <AnswerBubble who="Toi" text={answerText(e.mine)} mine />
            {e.theirs ? (
              <AnswerBubble who={name} text={answerText(e.theirs)} />
            ) : (
              <p className="text-sm text-muted">{name} n&apos;a pas répondu ce jour-là.</p>
            )}
          </div>
        </details>
      ))}
      {items.length > limit && (
        <Button variant="ghost" className="w-full" onClick={() => setLimit(limit + 20)}>
          Voir plus
        </Button>
      )}
    </div>
  );
}
