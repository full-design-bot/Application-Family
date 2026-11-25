"use client";

import { useState } from "react";
import { Avatar, Button, Textarea, cn } from "@/components/ui";
import type { Dilemme, DevineQuestion, Question36, QuiItem } from "@/content/jeux/types";
import { SERIES_36 } from "@/content/jeux/questions36";
import { useFamily } from "@/lib/family";
import { sameAnswer } from "@/lib/jeux/complicite";
import type { FormProps, RevealProps } from "./PairedDeck";
import { WaitingPartner } from "./PairedDeck";

function Verdict({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <p className={cn("animate-pop rounded-2xl px-3 py-2 text-center font-semibold", ok ? "bg-sage-soft" : "bg-sand-soft")}>{ok ? yes : no}</p>
  );
}

// ------------------------------------------------------------------ Devine ma réponse
export function DevinePrompt({ item }: { item: DevineQuestion }) {
  return <p className="text-xl font-bold leading-snug">{item.question}</p>;
}

function ChoiceList({ choices, value, onChange }: { choices: string[]; value: number | null; onChange: (i: number) => void }) {
  return (
    <div className="space-y-2">
      {choices.map((c, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={cn(
            "w-full rounded-2xl border px-4 py-3 text-left font-medium transition active:scale-[0.99]",
            value === i ? "border-accent bg-accent-soft" : "border-line bg-card",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

export function DevineForm({ item, busy, onSubmit }: FormProps<DevineQuestion>) {
  const { partner } = useFamily();
  const [answer, setAnswer] = useState<number | null>(null);
  const [guess, setGuess] = useState<number | null>(null);
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">1. Ta réponse</p>
        <ChoiceList choices={item.choices} value={answer} onChange={setAnswer} />
      </div>
      {answer !== null && (
        <div className="animate-pop">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">2. Et selon toi, {partner?.display_name ?? "l'autre"} a répondu…</p>
          <ChoiceList choices={item.choices} value={guess} onChange={setGuess} />
        </div>
      )}
      <Button size="lg" className="w-full" disabled={answer === null || guess === null} loading={busy} onClick={() => onSubmit(answer, guess)}>
        Valider
      </Button>
    </div>
  );
}

export function DevineReveal({ item, mine, theirs }: RevealProps<DevineQuestion>) {
  const { partner } = useFamily();
  const name = partner?.display_name ?? "L'autre";
  const c = (v: unknown) => (typeof v === "number" ? item.choices[v] : "—");
  if (!theirs) {
    return (
      <div className="space-y-2 text-sm">
        <p>
          Ta réponse : <span className="font-semibold">{c(mine.answer)}</span>
        </p>
        <p>
          Ton pronostic pour {name} : <span className="font-semibold">{c(mine.guess)}</span>
        </p>
        <WaitingPartner />
      </div>
    );
  }
  const iGuessed = sameAnswer(mine.guess, theirs.answer);
  const theyGuessed = sameAnswer(theirs.guess, mine.answer);
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-card-2 p-3">
          <p className="text-xs text-muted">Toi</p>
          <p className="font-semibold">{c(mine.answer)}</p>
        </div>
        <div className="rounded-2xl bg-card-2 p-3">
          <p className="text-xs text-muted">{name}</p>
          <p className="font-semibold">{c(theirs.answer)}</p>
        </div>
      </div>
      <p>
        {iGuessed ? "✅" : "❌"} Tu avais deviné <span className="font-semibold">{c(mine.guess)}</span>
      </p>
      <p>
        {theyGuessed ? "✅" : "❌"} {name} pensait que tu dirais <span className="font-semibold">{c(theirs.guess)}</span>
      </p>
      <Verdict
        ok={iGuessed && theyGuessed}
        yes="Télépathie totale 🔮 +2"
        no={iGuessed ? "Tu marques le point ! 🎯" : theyGuessed ? `${name} marque le point 🎯` : "Personne n'a deviné… vous vous surprenez encore 😄"}
      />
    </div>
  );
}

// ------------------------------------------------------------------ Qui de nous deux ?
export function QuiPrompt({ item }: { item: QuiItem }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">Qui de nous deux…</p>
      <p className="text-xl font-bold leading-snug">{item.text}</p>
    </div>
  );
}

export function QuiForm({ busy, onSubmit }: FormProps<QuiItem>) {
  const { me, partner, personOf } = useFamily();
  const options = [
    { id: me.id, label: "Moi" },
    ...(partner ? [{ id: partner.id, label: partner.display_name }] : []),
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={busy}
          onClick={() => onSubmit(o.id)}
          className="flex flex-col items-center gap-2 rounded-3xl border border-line bg-card p-4 transition active:scale-95 active:bg-accent-soft disabled:opacity-50"
        >
          <Avatar person={personOf(o.id)} size={56} />
          <span className="font-bold">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function QuiReveal({ mine, theirs }: RevealProps<QuiItem>) {
  const { me, partner, nameOf } = useFamily();
  const who = (v: unknown) => (v === me.id ? "toi" : v === partner?.id ? partner?.display_name : nameOf(String(v)));
  if (!theirs) {
    return (
      <div className="space-y-2 text-sm">
        <p>
          Tu as répondu : <span className="font-semibold">{who(mine.answer)}</span>
        </p>
        <WaitingPartner />
      </div>
    );
  }
  const agree = sameAnswer(mine.answer, theirs.answer);
  return (
    <div className="space-y-2 text-sm">
      <p>
        Toi : <span className="font-semibold">{who(mine.answer)}</span> · {partner?.display_name} : <span className="font-semibold">{who(theirs.answer)}</span>
      </p>
      <Verdict ok={agree} yes={`D'accord : c'est ${who(mine.answer)} ! 🤝`} no="Pas d'accord… à débattre ce soir 😄" />
    </div>
  );
}

// ------------------------------------------------------------------ Tu préfères…
export function DilemmePrompt() {
  return <p className="text-center text-xl font-bold">Tu préfères…</p>;
}

export function DilemmeForm({ item, busy, onSubmit }: FormProps<Dilemme>) {
  return (
    <div className="space-y-2">
      {(["a", "b"] as const).map((k, i) => (
        <div key={k}>
          {i === 1 && <p className="py-1 text-center text-sm font-semibold text-muted">ou</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => onSubmit(k)}
            className={cn(
              "w-full rounded-3xl p-5 text-center text-lg font-semibold transition active:scale-[0.98] disabled:opacity-50",
              k === "a" ? "bg-sky-soft" : "bg-rose-soft",
            )}
          >
            {item[k]}
          </button>
        </div>
      ))}
    </div>
  );
}

export function DilemmeReveal({ item, mine, theirs }: RevealProps<Dilemme>) {
  const { partner } = useFamily();
  const label = (v: unknown) => (v === "a" ? item.a : v === "b" ? item.b : "—");
  if (!theirs) {
    return (
      <div className="space-y-2 text-sm">
        <p>
          Ton choix : <span className="font-semibold">{label(mine.answer)}</span>
        </p>
        <WaitingPartner />
      </div>
    );
  }
  const agree = sameAnswer(mine.answer, theirs.answer);
  return (
    <div className="space-y-2 text-sm">
      {(["a", "b"] as const).map((k) => (
        <div key={k} className={cn("flex items-center justify-between gap-2 rounded-2xl px-3 py-2", k === "a" ? "bg-sky-soft" : "bg-rose-soft")}>
          <span className="font-medium">{item[k]}</span>
          <span className="shrink-0 text-xs font-semibold">
            {[mine.answer === k ? "Toi" : null, theirs.answer === k ? partner?.display_name : null].filter(Boolean).join(" + ")}
          </span>
        </div>
      ))}
      <Verdict ok={agree} yes="Même choix, évidemment 💞" no="Chacun ses goûts 😄" />
    </div>
  );
}

// ------------------------------------------------------------------ Les 36 questions
export function Q36Prompt({ item }: { item: Question36 }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">
        {SERIES_36[item.set].title} · Question {Number(item.key.slice(4))}
      </p>
      <p className="mt-1 text-lg font-bold leading-snug">{item.text}</p>
    </div>
  );
}

export function Q36Form({ busy, onSubmit }: FormProps<Question36>) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Prends ton temps, écris avec ton cœur…" rows={5} maxLength={4000} />
      <Button size="lg" className="w-full" disabled={text.trim().length < 2} loading={busy} onClick={() => onSubmit({ text: text.trim() })}>
        Envoyer ma réponse
      </Button>
    </div>
  );
}

const textOf = (v: unknown) => (v && typeof v === "object" && "text" in v ? String((v as { text: unknown }).text) : "");

export function Q36Reveal({ mine, theirs }: RevealProps<Question36>) {
  const { partner } = useFamily();
  return (
    <div className="space-y-2 text-sm">
      <div className="rounded-2xl bg-card-2 p-3">
        <p className="mb-1 text-xs font-semibold text-muted">Toi</p>
        <p className="whitespace-pre-wrap">{textOf(mine.answer)}</p>
      </div>
      {theirs ? (
        <div className="animate-pop rounded-2xl bg-rose-soft p-3">
          <p className="mb-1 text-xs font-semibold text-muted">{partner?.display_name}</p>
          <p className="whitespace-pre-wrap">{textOf(theirs.answer)}</p>
        </div>
      ) : (
        <WaitingPartner />
      )}
    </div>
  );
}
