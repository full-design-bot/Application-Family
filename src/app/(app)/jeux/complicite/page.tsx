"use client";

import Link from "next/link";
import { Avatar, Card, EmptyState, LinkButton, LoadingBlock, PageHeader, SectionTitle } from "@/components/ui";
import { useComplicity } from "@/components/jeux/useComplicity";
import { useFamily } from "@/lib/family";
import { complicityMessage, type ComplicityGame } from "@/lib/jeux/complicite";

const GAMES: { game: ComplicityGame; emoji: string; title: string; href: string; text: string }[] = [
  { game: "devine", emoji: "🔮", title: "Devine ma réponse", href: "/jeux/devine", text: "bonnes devinettes" },
  { game: "qui", emoji: "👉", title: "Qui de nous deux ?", href: "/jeux/qui", text: "fois d'accord" },
  { game: "tupreferes", emoji: "⚖️", title: "Tu préfères…", href: "/jeux/tu-preferes", text: "mêmes choix" },
];

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

export default function ComplicitePage() {
  const { me, partner, personOf } = useFamily();
  const c = useComplicity();

  return (
    <>
      <PageHeader title="💞 Complicité" subtitle="À quel point vous connaissez-vous ?" back="/jeux" />
      {c.loading ? (
        <LoadingBlock />
      ) : c.global.pct === null ? (
        <EmptyState
          emoji="💞"
          title="Pas encore de score"
          text="Répondez tous les deux à quelques questions des jeux découverte pour voir votre complicité grandir."
          action={<LinkButton href="/jeux/devine">Commencer</LinkButton>}
        />
      ) : (
        <>
          <Card className="bg-rose-soft text-center">
            <p className="text-6xl font-bold text-rose">{c.global.pct}%</p>
            <p className="mt-1 font-semibold">{complicityMessage(c.global.pct)}</p>
            <p className="mt-1 text-sm text-muted">
              {c.global.matches} concordances sur {c.global.total} · {c.pairs} question{c.pairs > 1 ? "s" : ""} à deux
            </p>
          </Card>

          <SectionTitle>Par jeu</SectionTitle>
          <div className="space-y-2">
            {GAMES.map((g) => {
              const t = c.byGame[g.game];
              return (
                <Link key={g.game} href={g.href} className="block rounded-3xl border border-line bg-card p-4 active:scale-[0.99]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {g.emoji} {g.title}
                    </span>
                    <span className="font-bold tabular-nums">{t.pct === null ? "—" : `${t.pct}%`}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-card-2">
                    <div className="h-full rounded-full bg-rose transition-all duration-700" style={{ width: `${t.pct ?? 0}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {t.total === 0 ? "Pas encore de réponses communes" : `${t.matches} ${g.text} sur ${t.total}`}
                  </p>
                </Link>
              );
            })}
          </div>

          {partner && (
            <>
              <SectionTitle>🎯 Devine ma réponse : les points</SectionTitle>
              <Card>
                <div className="flex justify-around text-center">
                  {[me, partner].map((m) => (
                    <div key={m.id} className="flex flex-col items-center gap-1">
                      <Avatar person={personOf(m.id)} size={40} />
                      <p className="text-sm font-semibold">{m.id === me.id ? "Toi" : m.display_name}</p>
                      <p className="text-2xl font-bold">{c.devinePoints[m.id] ?? 0}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {c.timeline.length > 0 && (
            <>
              <SectionTitle>📈 Évolution</SectionTitle>
              <Card>
                <div className="flex h-40 items-end gap-2">
                  {c.timeline.slice(-8).map((t) => (
                    <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs font-semibold tabular-nums">{t.pct}%</span>
                      <div className="flex w-full flex-1 items-end">
                        <div className="w-full rounded-t-xl bg-rose/80" style={{ height: `${Math.max(4, t.pct)}%` }} title={`${t.total} comparaisons`} />
                      </div>
                      <span className="text-[11px] text-muted">{monthLabel(t.month)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-center text-sm text-muted">
                  Score cumulé : <span className="font-semibold text-ink">{c.timeline[c.timeline.length - 1].cumulativePct}%</span>
                </p>
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}
