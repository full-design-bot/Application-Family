"use client";

import { Dices, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, EmptyState, IconButton, LoadingBlock, Segmented, Sheet, Textarea, cn, useToast } from "@/components/ui";
import { CoquinsPage, LevelPill, notifyCoquin, useSpicyLevel } from "@/components/jeux/coquins/shell";
import { errorText, randomId } from "@/components/jeux/data";
import { DEFIS } from "@/content/jeux/defis";
import { useFamily } from "@/lib/family";
import { fromNow } from "@/lib/dates";
import { LEVELS, levelsUpTo, toLevel, type SpicyLevel } from "@/lib/jeux/niveau";
import { shuffle } from "@/lib/jeux/random";
import { supabase } from "@/lib/supabase/client";
import type { Challenge } from "@/lib/types";

const STATUS: Record<Challenge["status"], { label: string; color: string }> = {
  sent: { label: "Envoyé", color: "bg-card-2 text-muted" },
  accepted: { label: "Accepté 😏", color: "bg-sand-soft text-ink" },
  done: { label: "Relevé ✅", color: "bg-sage-soft text-ink" },
  declined: { label: "Pas cette fois 💛", color: "bg-card-2 text-muted" },
};

function Defis() {
  const { me, partner, nameOf } = useFamily();
  const { level } = useSpicyLevel();
  const toast = useToast();
  const [list, setList] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"recus" | "envoyes">("recus");
  const [open, setOpen] = useState(false);
  const [lvl, setLvl] = useState<SpicyLevel>(1);
  const [seed, setSeed] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase().from("challenges").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as Challenge[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const sb = supabase();
    const ch = sb
      .channel(`jeux-defis-${randomId()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [load]);

  const chosenLevel = lvl <= level ? lvl : level;
  const ideas = useMemo(
    () => shuffle(DEFIS.filter((d) => d.level === chosenLevel)).slice(0, 6),
    // seed : nouveau tirage à la demande
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chosenLevel, seed],
  );

  async function send() {
    if (!partner || !text.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase().from("challenges").insert({ from_id: me.id, to_id: partner.id, text: text.trim(), level: chosenLevel });
      if (error) throw error;
      notifyCoquin("defis");
      toast(`Défi envoyé à ${partner.display_name} 😏`, "success");
      setOpen(false);
      setText("");
      setTab("envoyes");
      load();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(c: Challenge, status: Challenge["status"]) {
    const { error } = await supabase()
      .from("challenges")
      .update({ status, done_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", c.id);
    if (error) return toast(errorText(error), "error");
    notifyCoquin("defis");
    if (status === "done") toast("Défi relevé, bravo 🔥", "success");
    if (status === "declined") toast("C'est noté, en toute bienveillance 💛");
    load();
  }

  async function remove(c: Challenge) {
    const { error } = await supabase().from("challenges").delete().eq("id", c.id);
    if (error) return toast(errorText(error), "error");
    load();
  }

  if (loading) return <LoadingBlock />;

  const received = list.filter((c) => c.to_id === me.id);
  const sent = list.filter((c) => c.from_id === me.id);
  const shown = tab === "recus" ? received : sent;
  const pendingCount = received.filter((c) => c.status === "sent" || c.status === "accepted").length;

  return (
    <>
      <Button size="lg" className="mb-4 w-full" onClick={() => setOpen(true)} disabled={!partner}>
        <Send className="size-5" /> Lancer un défi
      </Button>

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "recus", label: `Reçus${pendingCount ? ` (${pendingCount})` : ""}` },
          { value: "envoyes", label: "Envoyés" },
        ]}
      />

      {shown.length === 0 ? (
        <EmptyState emoji="😏" title={tab === "recus" ? "Aucun défi reçu" : "Aucun défi envoyé"} text="Un petit défi pour pimenter la journée ?" />
      ) : (
        <div className="space-y-3">
          {shown.map((c) => {
            const hidden = toLevel(c.level) > level;
            const incoming = c.to_id === me.id;
            return (
              <Card key={c.id} className={cn("space-y-3", c.status === "declined" && "opacity-70")}>
                <div className="flex items-center justify-between gap-2">
                  <LevelPill level={toLevel(c.level)} />
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS[c.status].color)}>{STATUS[c.status].label}</span>
                </div>
                <p className="text-lg font-semibold leading-snug">
                  {hidden ? "🔒 Défi masqué : il dépasse votre niveau actuel." : c.text}
                </p>
                <p className="text-xs text-muted">
                  {incoming ? `De ${nameOf(c.from_id)}` : `Pour ${nameOf(c.to_id)}`} · {fromNow(c.created_at)}
                  {c.done_at && ` · relevé ${fromNow(c.done_at)}`}
                </p>
                {incoming && !hidden && c.status === "sent" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => setStatus(c, "declined")}>
                      Pas cette fois 💛
                    </Button>
                    <Button onClick={() => setStatus(c, "accepted")}>J&apos;accepte 😏</Button>
                  </div>
                )}
                {incoming && !hidden && c.status === "accepted" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => setStatus(c, "declined")}>
                      Finalement non
                    </Button>
                    <Button onClick={() => setStatus(c, "done")}>Défi relevé ✅</Button>
                  </div>
                )}
                {!incoming && (
                  <div className="flex justify-end">
                    <IconButton label="Supprimer le défi" onClick={() => remove(c)}>
                      <Trash2 className="size-4 text-muted" />
                    </IconButton>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="😏 Lancer un défi">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {levelsUpTo(level).map((l) => (
              <Chip key={l} active={chosenLevel === l} onClick={() => setLvl(l)}>
                {LEVELS[l].emoji} {LEVELS[l].label}
              </Chip>
            ))}
          </div>
          <div className="space-y-2">
            {ideas.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setText(d.text)}
                className={cn("w-full rounded-2xl border px-4 py-3 text-left text-sm transition", text === d.text ? "border-accent bg-accent-soft" : "border-line bg-card")}
              >
                {d.text}
              </button>
            ))}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setSeed((s) => s + 1)}>
              <Dices className="size-4" /> D&apos;autres idées
            </Button>
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="…ou écris ton propre défi" maxLength={400} />
          <Button size="lg" className="w-full" onClick={send} loading={busy} disabled={!text.trim()}>
            Envoyer à {partner?.display_name}
          </Button>
          <p className="text-center text-xs text-muted">{partner?.display_name} pourra toujours décliner poliment 💛</p>
        </div>
      </Sheet>
    </>
  );
}

export default function DefisPage() {
  return (
    <CoquinsPage title="😏 Défis à distance" subtitle="Un défi, une réponse, un sourire">
      <Defis />
    </CoquinsPage>
  );
}
