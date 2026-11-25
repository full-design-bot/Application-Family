"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, cn } from "@/components/ui";
import { CoquinsPage, LevelPill, useSpicyLevel } from "@/components/jeux/coquins/shell";
import { useFamily } from "@/lib/family";
import { LEVELS } from "@/lib/jeux/niveau";
import { supabase } from "@/lib/supabase/client";

const GAMES = [
  { href: "/jeux/coquins/envies", emoji: "💞", title: "Envies en commun", text: "Seules vos envies partagées se dévoilent", color: "bg-rose-soft", count: "envies" },
  { href: "/jeux/coquins/de", emoji: "🎲", title: "Le dé coquin", text: "Une action, un endroit… à vous de jouer", color: "bg-accent-soft" },
  { href: "/jeux/coquins/action-verite", emoji: "🔥", title: "Action ou vérité", text: "Version hot, « passer » toujours permis", color: "bg-sand-soft" },
  { href: "/jeux/coquins/bons", emoji: "🎟️", title: "Bons pour…", text: "Offre des bons à utiliser quand l'envie vient", color: "bg-sage-soft", count: "bons" },
  { href: "/jeux/coquins/defis", emoji: "😏", title: "Défis à distance", text: "Un petit défi pour pimenter la journée", color: "bg-sky-soft", count: "defis" },
  { href: "/jeux/coquins/tu-preferes", emoji: "⚖️", title: "Tu préfères… hot", text: "Des dilemmes brûlants", color: "bg-rose-soft" },
] as const;

function Hub() {
  const { me, partner } = useFamily();
  const { level, mine, partnerLevel } = useSpicyLevel();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const sb = supabase();
    Promise.all([
      sb.from("coupons").select("id", { count: "exact", head: true }).eq("to_id", me.id).eq("spicy", true).is("used_at", null),
      sb.from("challenges").select("id", { count: "exact", head: true }).eq("to_id", me.id).in("status", ["sent", "accepted"]),
    ]).then(([c, d]) => setCounts({ bons: c.count ?? 0, defis: d.count ?? 0 }));
  }, [me.id]);

  return (
    <>
      <Card className="mb-4 bg-rose-soft">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Votre niveau du moment</p>
          <LevelPill level={level} className="bg-card" />
        </div>
        <p className="mt-2 text-sm text-muted">
          On suit toujours le niveau le plus doux de vous deux : toi {LEVELS[mine].emoji}
          {partner ? ` · ${partner.display_name} ${partnerLevel ? LEVELS[partnerLevel].emoji : "😊"}` : ""}. Tu peux changer le tien dans{" "}
          <Link href="/reglages" className="font-semibold underline">
            Réglages
          </Link>
          . Ici, tout se fait dans le respect et la bonne humeur : on peut toujours dire non 💛
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {GAMES.map((g) => {
          const n = "count" in g ? counts[g.count] ?? 0 : 0;
          return (
            <Link key={g.href} href={g.href} className={cn("relative rounded-3xl p-4 transition active:scale-[0.98]", g.color)}>
              {n > 0 && <Badge className="absolute right-3 top-3">{n}</Badge>}
              <div className="text-3xl">{g.emoji}</div>
              <p className="mt-2 font-bold">{g.title}</p>
              <p className="text-sm leading-snug text-muted">{g.text}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}

export default function CoquinsHubPage() {
  return (
    <CoquinsPage title="🔥 Coquins" subtitle="Rien que pour vous deux" back="/jeux">
      <Hub />
    </CoquinsPage>
  );
}
