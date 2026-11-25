"use client";

import { Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Toggle, cn, useToast } from "@/components/ui";
import { CoquinsPage, LevelPill, notifyCoquin, useSpicyLevel } from "@/components/jeux/coquins/shell";
import { errorText } from "@/components/jeux/data";
import { DE_ACTIONS, DE_CORPS, DE_LIEUX } from "@/content/jeux/de-coquin";
import type { FaceDe } from "@/content/jeux/types";
import { useFamily } from "@/lib/family";
import { combineDice, toLevel, withinLevel } from "@/lib/jeux/niveau";
import { pick } from "@/lib/jeux/random";
import { supabase } from "@/lib/supabase/client";

function Die({ face, rolling, label, color }: { face: FaceDe | null; rolling: boolean; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn("flex aspect-square w-full max-w-36 flex-col items-center justify-center rounded-[28px] p-2 text-center shadow-md", color)}
        style={rolling ? { animation: "jeux-roll 0.35s linear infinite" } : undefined}
      >
        <span className="text-4xl">{face?.emoji ?? "🎲"}</span>
        <span className="mt-1 line-clamp-3 text-xs font-semibold leading-tight">{face?.text ?? "?"}</span>
      </div>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}

function DeCoquin() {
  const { me, partner } = useFamily();
  const { level } = useSpicyLevel();
  const toast = useToast();
  const actions = useMemo(() => withinLevel(DE_ACTIONS, level), [level]);
  const zones = useMemo(() => withinLevel(DE_CORPS, level), [level]);
  const lieux = useMemo(() => withinLevel(DE_LIEUX, level), [level]);
  const [withPlace, setWithPlace] = useState(false);
  const [faces, setFaces] = useState<[FaceDe | null, FaceDe | null, FaceDe | null]>([null, null, null]);
  const [rolling, setRolling] = useState(false);
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  function roll() {
    if (rolling) return;
    setRolling(true);
    const draw = (): [FaceDe, FaceDe, FaceDe] => [pick(actions), pick(zones), pick(lieux)];
    timer.current = setInterval(() => setFaces(draw()), 90);
    setTimeout(() => {
      if (timer.current) clearInterval(timer.current);
      setFaces(draw());
      setRolling(false);
      navigator.vibrate?.(30);
    }, 1100);
  }

  const [a, z, l] = faces;
  const sentence = a && z ? combineDice(a.text, z.text, withPlace ? l?.text : null) : null;
  const faceLevel = toLevel(Math.max(a?.level ?? 1, z?.level ?? 1, withPlace ? l?.level ?? 1 : 1));

  async function sendAsChallenge() {
    if (!sentence || !partner) return;
    setSending(true);
    try {
      const { error } = await supabase()
        .from("challenges")
        .insert({ from_id: me.id, to_id: partner.id, text: `🎲 ${sentence}`, level: faceLevel });
      if (error) throw error;
      notifyCoquin("defis");
      toast(`Défi envoyé à ${partner.display_name} 😏`, "success");
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <style>{`@keyframes jeux-roll { 0% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-12deg) scale(0.94); } 50% { transform: rotate(0deg) scale(1.04); } 75% { transform: rotate(12deg) scale(0.94); } 100% { transform: rotate(0deg) scale(1); } }`}</style>

      <div className="flex justify-center">
        <LevelPill level={level} />
      </div>

      <div className={cn("grid gap-3", withPlace ? "grid-cols-3" : "grid-cols-2")}>
        <Die face={a} rolling={rolling} label="Action" color="bg-rose-soft" />
        <Die face={z} rolling={rolling} label="Où ?" color="bg-accent-soft" />
        {withPlace && <Die face={l} rolling={rolling} label="Lieu" color="bg-sand-soft" />}
      </div>

      {sentence && !rolling && (
        <Card key={sentence} className="animate-pop bg-rose-soft text-center">
          <p className="text-xl font-bold leading-snug">{sentence}</p>
          <p className="mt-1 text-sm text-muted">Envie de passer ? Relance, tout simplement 😉</p>
        </Card>
      )}

      <Button size="lg" className="w-full" onClick={roll} disabled={rolling}>
        🎲 {a ? "Relancer les dés" : "Lancer les dés"}
      </Button>

      {sentence && !rolling && partner && (
        <Button variant="secondary" className="w-full" onClick={sendAsChallenge} loading={sending}>
          <Send className="size-4" /> L&apos;envoyer en défi à {partner.display_name}
        </Button>
      )}

      <Card>
        <Toggle checked={withPlace} onChange={setWithPlace} label="Ajouter le dé du lieu" description="Canapé, douche, bougies… selon votre niveau" />
      </Card>
    </div>
  );
}

export default function DePage() {
  return (
    <CoquinsPage title="🎲 Le dé coquin" subtitle="Lance, et laisse le hasard décider">
      <DeCoquin />
    </CoquinsPage>
  );
}
