"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, EmptyState, LoadingBlock, Segmented, cn, useToast } from "@/components/ui";
import { CoquinsPage, LevelPill, notifyCoquin, useSpicyLevel } from "@/components/jeux/coquins/shell";
import { errorText } from "@/components/jeux/data";
import { ENVIES } from "@/content/jeux/envies";
import type { Envie } from "@/content/jeux/types";
import { useFamily } from "@/lib/family";
import { withinLevel } from "@/lib/jeux/niveau";
import { supabase } from "@/lib/supabase/client";

type Answer = "yes" | "maybe" | "no";
const ANSWERS: { value: Answer; emoji: string; label: string; color: string }[] = [
  { value: "yes", emoji: "😍", label: "Oui !", color: "bg-sage text-white" },
  { value: "maybe", emoji: "🤔", label: "Peut-être", color: "bg-sand text-ink" },
  { value: "no", emoji: "🙅", label: "Non merci", color: "bg-card-2 text-ink" },
];

function Envies() {
  const { me, partner } = useFamily();
  const { level } = useSpicyLevel();
  const toast = useToast();
  const items = useMemo(() => withinLevel(ENVIES, level), [level]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [matches, setMatches] = useState<Record<string, "match" | "explore">>({});
  const [partnerCount, setPartnerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"repondre" | "commun" | "miennes">("repondre");
  const [busy, setBusy] = useState(false);

  const loadMatches = useCallback(async () => {
    const [{ data: m }, { data: p }] = await Promise.all([supabase().rpc("desire_matches"), supabase().rpc("desire_partner_progress")]);
    const out: Record<string, "match" | "explore"> = {};
    for (const r of (m ?? []) as { item_key: string; level: "match" | "explore" }[]) out[r.item_key] = r.level;
    setMatches(out);
    setPartnerCount(typeof p === "number" ? p : 0);
    return out;
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase().from("desire_answers").select("item_key, answer").eq("member_id", me.id);
    const a: Record<string, Answer> = {};
    for (const r of (data ?? []) as { item_key: string; answer: Answer }[]) a[r.item_key] = r.answer;
    setAnswers(a);
    await loadMatches();
    setLoading(false);
  }, [me.id, loadMatches]);

  useEffect(() => {
    load();
  }, [load]);

  async function answer(item: Envie, value: Answer) {
    if (busy) return;
    setBusy(true);
    const before = matches[item.key];
    try {
      const { error } = await supabase()
        .from("desire_answers")
        .upsert({ item_key: item.key, member_id: me.id, answer: value, updated_at: new Date().toISOString() }, { onConflict: "item_key,member_id" });
      if (error) throw error;
      setAnswers((a) => ({ ...a, [item.key]: value }));
      const after = await loadMatches();
      if (after[item.key] === "match" && before !== "match") {
        toast("💞 Nouvelle envie en commun !", "success");
        notifyCoquin("envies");
      }
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;

  const todo = items.filter((i) => !answers[i.key]);
  const current = todo[0];
  const answered = items.filter((i) => answers[i.key]);
  const matched = items.filter((i) => matches[i.key] === "match");
  const explore = items.filter((i) => matches[i.key] === "explore");

  return (
    <>
      <Card className="mb-4 text-sm text-muted">
        Réponds en secret. Seules les envies que vous partagez tous les deux se dévoilent. Un « non » n&apos;est{" "}
        <span className="font-semibold text-ink">jamais</span> révélé, et tu peux changer d&apos;avis quand tu veux.
        {partner && (
          <span className="mt-2 block">
            {partner.display_name} a répondu à <span className="font-semibold text-ink">{partnerCount}</span> envie{partnerCount > 1 ? "s" : ""}.
          </span>
        )}
      </Card>

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "repondre", label: `Répondre${todo.length ? ` (${todo.length})` : ""}` },
          { value: "commun", label: `En commun 💞${matched.length ? ` ${matched.length}` : ""}` },
          { value: "miennes", label: "Mes réponses" },
        ]}
      />

      {tab === "repondre" &&
        (current ? (
          <Card key={current.key} className="animate-pop space-y-5 py-8 text-center">
            <div className="text-6xl">{current.emoji}</div>
            <p className="px-2 text-xl font-bold leading-snug">{current.text}</p>
            <LevelPill level={current.level} />
            <div className="grid grid-cols-3 gap-2">
              {ANSWERS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  disabled={busy}
                  onClick={() => answer(current, a.value)}
                  className={cn("flex flex-col items-center gap-1 rounded-2xl py-3 font-semibold transition active:scale-95 disabled:opacity-50", a.color)}
                >
                  <span className="text-2xl">{a.emoji}</span>
                  <span className="text-sm">{a.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              {answered.length} / {items.length} répondues
            </p>
          </Card>
        ) : (
          <EmptyState emoji="✨" title="Tu as répondu à tout !" text="Va voir vos envies en commun, ou change d'avis dans « Mes réponses »." />
        ))}

      {tab === "commun" && (
        <div className="space-y-4">
          {matched.length === 0 && explore.length === 0 ? (
            <EmptyState
              emoji="🤞"
              title="Pas encore d'envie en commun"
              text={partner ? `Dès que vous serez d'accord tous les deux, ça s'affichera ici.` : "L'autre parent doit d'abord répondre."}
            />
          ) : (
            <>
              {matched.length > 0 && (
                <div>
                  <p className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-muted">💞 Vous en avez tous les deux envie</p>
                  <div className="space-y-2">
                    {matched.map((i) => (
                      <div key={i.key} className="flex items-center gap-3 rounded-2xl bg-rose-soft p-3">
                        <span className="text-2xl">{i.emoji}</span>
                        <span className="flex-1 font-medium">{i.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {explore.length > 0 && (
                <div>
                  <p className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-muted">🌱 À explorer ensemble (un oui + un peut-être)</p>
                  <div className="space-y-2">
                    {explore.map((i) => (
                      <div key={i.key} className="flex items-center gap-3 rounded-2xl bg-sand-soft p-3">
                        <span className="text-2xl">{i.emoji}</span>
                        <span className="flex-1 font-medium">{i.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "miennes" && (
        <div className="space-y-2">
          {answered.length === 0 && <EmptyState emoji="📝" title="Aucune réponse pour l'instant" />}
          {answered.map((i) => (
            <Card key={i.key} className="space-y-2 p-3">
              <p className="font-medium">
                {i.emoji} {i.text}
              </p>
              <div className="flex gap-1.5">
                {ANSWERS.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    disabled={busy}
                    onClick={() => answers[i.key] !== a.value && answer(i, a.value)}
                    className={cn(
                      "flex-1 rounded-xl py-2 text-sm font-semibold transition",
                      answers[i.key] === a.value ? a.color : "bg-card-2 text-muted",
                    )}
                  >
                    {a.emoji} {a.label}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export default function EnviesPage() {
  return (
    <CoquinsPage title="💞 Envies en commun" subtitle="Oui, peut-être ou non : en secret">
      <Envies />
    </CoquinsPage>
  );
}
