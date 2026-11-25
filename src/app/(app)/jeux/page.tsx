"use client";

import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Badge, Card, LoadingBlock, PageHeader, SectionTitle, cn } from "@/components/ui";
import { GameRow } from "@/components/jeux/GameRow";
import { NewGameSheet } from "@/components/jeux/NewGameSheet";
import { useGames, usePairedPending } from "@/components/jeux/hooks";
import { useComplicity } from "@/components/jeux/useComplicity";
import { useFamily } from "@/lib/family";
import { complicityMessage } from "@/lib/jeux/complicite";
import { GAME_META, GAME_TYPES, isMyTurn, victories, type GameType } from "@/lib/jeux/games";

const DISCOVERY = [
  { href: "/jeux/devine", game: "devine", emoji: "🔮", title: "Devine ma réponse", text: "Réponds, puis devine sa réponse", color: "bg-sky-soft" },
  { href: "/jeux/qui", game: "qui", emoji: "👉", title: "Qui de nous deux ?", text: "Êtes-vous d'accord ?", color: "bg-sand-soft" },
  { href: "/jeux/tu-preferes", game: "tupreferes", emoji: "⚖️", title: "Tu préfères…", text: "Des dilemmes à deux", color: "bg-sage-soft" },
  { href: "/jeux/36-questions", game: "36q", emoji: "💬", title: "Les 36 questions", text: "Pour se rapprocher encore", color: "bg-rose-soft" },
];

export default function JeuxPage() {
  const { me, partner, isParent, personOf } = useFamily();
  const { games, loading } = useGames();
  const { pending } = usePairedPending(DISCOVERY.map((d) => d.game));
  const complicity = useComplicity();
  const [newType, setNewType] = useState<GameType | null>(null);

  const myTurn = useMemo(() => games.filter((g) => isMyTurn(g, me.id)), [games, me.id]);
  const waiting = useMemo(() => games.filter((g) => g.status !== "finished" && !isMyTurn(g, me.id)), [games, me.id]);
  const finished = useMemo(() => games.filter((g) => g.status === "finished"), [games]);
  const wins = useMemo(() => victories(games, [me.id, partner?.id ?? ""].filter(Boolean)), [games, me.id, partner?.id]);
  const pendingCount = Object.values(pending).reduce((n, l) => n + l.length, 0);

  return (
    <>
      <PageHeader title="Jeux" subtitle="À deux, même à distance 💞" />

      {!isParent ? (
        <Card className="text-center text-muted">Les jeux à deux sont réservés aux comptes parents pour l&apos;instant.</Card>
      ) : (
        <>
          {loading ? (
            <LoadingBlock />
          ) : (
            (myTurn.length > 0 || pendingCount > 0) && (
              <>
                <SectionTitle>
                  À toi de jouer ! <Badge className="ml-1 align-middle">{myTurn.length + pendingCount}</Badge>
                </SectionTitle>
                <div className="space-y-2">
                  {myTurn.map((g) => (
                    <GameRow key={g.id} game={g} />
                  ))}
                  {DISCOVERY.filter((d) => pending[d.game]?.length).map((d) => (
                    <Link
                      key={d.game}
                      href={d.href}
                      className="flex items-center gap-3 rounded-3xl bg-accent p-3 text-accent-ink shadow-sm active:scale-[0.99]"
                    >
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-white/20 text-2xl">{d.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{d.title}</span>
                        <span className="block text-sm font-semibold">
                          {partner?.display_name ?? "L'autre"} a répondu à {pending[d.game].length} question{pending[d.game].length > 1 ? "s" : ""}, à toi !
                        </span>
                      </span>
                      <ChevronRight className="size-5 opacity-80" />
                    </Link>
                  ))}
                </div>
              </>
            )
          )}

          {waiting.length > 0 && (
            <>
              <SectionTitle>Parties en cours</SectionTitle>
              <div className="space-y-2">
                {waiting.map((g) => (
                  <GameRow key={g.id} game={g} />
                ))}
              </div>
            </>
          )}

          <SectionTitle>🎲 Classiques</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {GAME_TYPES.map((t) => {
              const m = GAME_META[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewType(t)}
                  className={cn("rounded-3xl p-4 text-left transition active:scale-[0.98]", m.color, t === "dessin" && "col-span-2")}
                >
                  <div className="text-3xl">{m.emoji}</div>
                  <p className="mt-2 font-bold">{m.label}</p>
                  <p className="text-sm leading-snug text-muted">{m.description}</p>
                </button>
              );
            })}
          </div>

          <SectionTitle>💡 Pour mieux se connaître</SectionTitle>
          <Link href="/jeux/complicite" className="mb-3 block rounded-3xl border border-line bg-card p-4 active:scale-[0.99]">
            <div className="flex items-center gap-4">
              <ScoreRing pct={complicity.global.pct} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">Score de complicité</p>
                <p className="text-sm text-muted">{complicityMessage(complicity.global.pct)}</p>
              </div>
              <ChevronRight className="size-5 text-muted" />
            </div>
          </Link>
          <div className="grid grid-cols-2 gap-3">
            {DISCOVERY.map((d) => (
              <Link key={d.href} href={d.href} className={cn("relative rounded-3xl p-4 transition active:scale-[0.98]", d.color)}>
                {pending[d.game]?.length > 0 && <Badge className="absolute right-3 top-3">{pending[d.game].length}</Badge>}
                <div className="text-3xl">{d.emoji}</div>
                <p className="mt-2 font-bold">{d.title}</p>
                <p className="text-sm leading-snug text-muted">{d.text}</p>
              </Link>
            ))}
          </div>

          <SectionTitle>🔥 Coquins</SectionTitle>
          <Link href="/jeux/coquins" className="flex items-center gap-4 rounded-3xl bg-rose-soft p-4 active:scale-[0.99]">
            <span className="flex size-12 items-center justify-center rounded-full bg-rose text-white">
              <Lock className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Rien que pour vous deux</span>
              <span className="block text-sm text-muted">Envies, dé coquin, action ou vérité… Verrouillé 🔒</span>
            </span>
            <ChevronRight className="size-5 text-muted" />
          </Link>

          {partner && finished.length > 0 && (
            <>
              <SectionTitle>🏆 Victoires</SectionTitle>
              <Card>
                <div className="flex items-center justify-around text-center">
                  {[me, partner].map((m) => (
                    <div key={m.id} className="flex flex-col items-center gap-1">
                      <Avatar person={personOf(m.id)} size={44} />
                      <p className="text-sm font-semibold">{m.id === me.id ? "Toi" : m.display_name}</p>
                      <p className="text-3xl font-bold">{wins.total[m.id] ?? 0}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                  {GAME_TYPES.filter((t) => wins.byType[t]).map((t) => (
                    <div key={t} className="flex items-center justify-between">
                      <span>
                        {GAME_META[t].emoji} {GAME_META[t].label}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {wins.byType[t][me.id] ?? 0} – {wins.byType[t][partner.id] ?? 0}
                      </span>
                    </div>
                  ))}
                  {wins.draws > 0 && <p className="text-muted">🤝 {wins.draws} égalité{wins.draws > 1 ? "s" : ""}</p>}
                </div>
              </Card>

              <SectionTitle>Dernières parties</SectionTitle>
              <div className="space-y-2">
                {finished.slice(0, 5).map((g) => (
                  <GameRow key={g.id} game={g} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <NewGameSheet type={newType} onClose={() => setNewType(null)} />
    </>
  );
}

function ScoreRing({ pct }: { pct: number | null }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-card-2" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-rose transition-all duration-700"
          strokeDasharray={c}
          strokeDashoffset={c - (c * (pct ?? 0)) / 100}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{pct === null ? "💞" : `${pct}%`}</span>
    </div>
  );
}
