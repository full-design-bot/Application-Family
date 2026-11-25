"use client";

import { Eraser, Send, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Button, Card, Input, cn, useToast } from "@/components/ui";
import { MOTS_DESSIN } from "@/content/jeux/mots";
import { useFamily } from "@/lib/family";
import { CANVAS, clampPoint, MAX_STROKES, normalizeStrokes, PALETTE, SIZES, strokePath, thinPoints, type Stroke } from "@/lib/jeux/dessin";
import { GAME_META, ownerOf } from "@/lib/jeux/games";
import { supabase } from "@/lib/supabase/client";
import type { Game } from "@/lib/types";
import { errorText, fetchGame, getMySecret, notifyGame, randomId, updateGame } from "./data";
import { GameFrame } from "./GameFrame";
import { WordSetup } from "./WordSetup";

// Le dessin se fait sur une « feuille » claire, identique sur les deux téléphones
// (même en mode sombre, pour que les couleurs restent fidèles).
const PAPER = "#fffaf3";

function Canvas({
  strokes,
  live,
  drawable,
  onStroke,
  onLive,
  color,
  size,
}: {
  strokes: Stroke[];
  live: Stroke[];
  drawable: boolean;
  onStroke?: (s: Stroke) => void;
  onLive?: (s: Stroke) => void;
  color?: string;
  size?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const currentRef = useRef<Stroke | null>(null);
  const lastSent = useRef(0);

  const toPoint = (e: React.PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return clampPoint(((e.clientX - r.left) / r.width) * CANVAS, ((e.clientY - r.top) / r.height) * CANVAS);
  };

  function down(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const s: Stroke = { id: randomId(), color: color ?? PALETTE[0], size: size ?? SIZES[1], points: [toPoint(e)] };
    currentRef.current = s;
    setCurrent(s);
    onLive?.(s);
  }

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const s = currentRef.current;
    if (!drawable || !s) return;
    const next = { ...s, points: [...s.points, toPoint(e)] };
    currentRef.current = next;
    setCurrent(next);
    const now = Date.now();
    if (now - lastSent.current > 60) {
      lastSent.current = now;
      onLive?.(next);
    }
  }

  function up() {
    const s = currentRef.current;
    currentRef.current = null;
    setCurrent(null);
    if (s) onStroke?.({ ...s, points: thinPoints(s.points) });
  }

  const all = current ? [...live, current] : live;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      className={cn("aspect-square w-full rounded-3xl border border-line shadow-inner", drawable && "cursor-crosshair")}
      style={{ background: PAPER, touchAction: "none" }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {strokes.map((s) => (
        <path key={s.id} d={strokePath(s)} fill={s.color} />
      ))}
      {all.map((s) => (
        <path key={`live-${s.id}`} d={strokePath(s, false)} fill={s.color} />
      ))}
    </svg>
  );
}

export function DessinGame({ game, onChange }: { game: Game; onChange: (g: Game) => void }) {
  const { me, nameOf } = useFamily();
  const owner = ownerOf(game);
  const iDraw = owner === me.id;
  const guesser = game.players.find((p) => p !== owner) ?? null;

  if (game.status === "setup") {
    return (
      <GameFrame game={game}>
        {iDraw ? (
          <WordSetup
            game={game}
            words={MOTS_DESSIN}
            allowCustom={false}
            intro={`Voici ton mot ! Dessine-le pour que ${nameOf(guesser)} le devine. Pas de lettres ni de chiffres, hein 😉`}
            startLabel="Je dessine ✏️"
            notifyTitle={GAME_META.dessin.turnTitle}
            notifyBody={`${me.display_name} commence à dessiner pour toi : viens deviner en direct !`}
            onChange={onChange}
          />
        ) : (
          <Card className="py-8 text-center">
            <p className="text-4xl">✏️</p>
            <p className="mt-2 font-semibold">{nameOf(owner)} découvre son mot…</p>
            <p className="text-sm text-muted">Le dessin apparaîtra ici en direct.</p>
          </Card>
        )}
      </GameFrame>
    );
  }

  return (
    <GameFrame game={game}>
      {iDraw ? <DrawerView game={game} onChange={onChange} /> : <GuesserView game={game} onChange={onChange} />}
    </GameFrame>
  );
}

/** Canal temps réel du dessin. */
function useDrawingChannel(gameId: string, handlers?: { live?: (s: Stroke) => void; end?: (s: Stroke) => void; undo?: (id: string) => void; clear?: () => void }) {
  const chRef = useRef<RealtimeChannel | null>(null);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const sb = supabase();
    const ch = sb
      .channel(`jeux-dessin-${gameId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "live" }, ({ payload }) => handlersRef.current?.live?.(payload as Stroke))
      .on("broadcast", { event: "end" }, ({ payload }) => handlersRef.current?.end?.(payload as Stroke))
      .on("broadcast", { event: "undo" }, ({ payload }) => handlersRef.current?.undo?.(String((payload as { id: string }).id)))
      .on("broadcast", { event: "clear" }, () => handlersRef.current?.clear?.())
      .subscribe();
    chRef.current = ch;
    return () => {
      chRef.current = null;
      sb.removeChannel(ch);
    };
  }, [gameId]);

  return useCallback((event: string, payload: unknown) => {
    void chRef.current?.send({ type: "broadcast", event, payload });
  }, []);
}

function Guesses({ game }: { game: Game }) {
  const guesses = Array.isArray(game.state.guesses) ? (game.state.guesses as string[]) : [];
  if (!guesses.length) return null;
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
      {guesses.map((g, i) => (
        <span key={i} className="rounded-full bg-card-2 px-3 py-1 text-sm text-muted">
          {g}
        </span>
      ))}
    </div>
  );
}

function DrawerView({ game, onChange }: { game: Game; onChange: (g: Game) => void }) {
  const { me, nameOf } = useFamily();
  const toast = useToast();
  const [strokes, setStrokes] = useState<Stroke[]>(() => normalizeStrokes(game.state.strokes));
  const strokesRef = useRef(strokes);
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [word, setWord] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const send = useDrawingChannel(game.id);
  const active = game.status === "active";
  const guesser = game.players.find((p) => p !== me.id) ?? null;

  useEffect(() => {
    getMySecret<{ word?: string }>(game.id, me.id).then((s) => setWord(s?.word ?? null));
  }, [game.id, me.id]);

  // Partie finie sans révélation (l'autre a donné sa langue au chat) : on dévoile le mot.
  useEffect(() => {
    if (game.status === "finished" && !game.state.word && word) {
      updateGame(game.id, (g) => (g.state.word ? null : { state: { ...g.state, word } }))
        .then((g) => g && onChange(g))
        .catch(() => {});
    }
  }, [game.status, game.state.word, game.id, word, onChange]);

  const persist = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateGame(game.id, (g) => (g.status === "finished" ? null : { state: { ...g.state, strokes: strokesRef.current } }))
        .then((g) => g && onChange(g))
        .catch((e) => toast(errorText(e), "error"));
    }, 500);
  }, [game.id, onChange, toast]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  function commit(next: Stroke[]) {
    strokesRef.current = next;
    setStrokes(next);
    persist();
  }

  return (
    <div>
      {word && (
        <p className="mb-2 text-center text-sm text-muted">
          Ton mot : <span className="font-bold uppercase text-accent">{word}</span>
        </p>
      )}
      <Canvas
        strokes={strokes}
        live={[]}
        drawable={active}
        color={color}
        size={size}
        onLive={(s) => send("live", s)}
        onStroke={(s) => {
          if (strokesRef.current.length >= MAX_STROKES) {
            toast("Ton dessin est déjà bien rempli 😄", "error");
            return;
          }
          send("end", s);
          commit([...strokesRef.current, s]);
        }}
      />
      {active && (
        <>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Couleur ${c}`}
                  onClick={() => setColor(c)}
                  className={cn("size-8 rounded-full border-2 transition", color === c ? "scale-110 border-ink" : "border-transparent")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                aria-label={`Épaisseur ${s}`}
                className={cn("flex size-11 items-center justify-center rounded-2xl border", size === s ? "border-accent bg-accent-soft" : "border-line bg-card")}
              >
                <span className="rounded-full" style={{ width: s / 2 + 2, height: s / 2 + 2, background: color }} />
              </button>
            ))}
            <div className="flex-1" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const last = strokesRef.current[strokesRef.current.length - 1];
                if (!last) return;
                send("undo", { id: last.id });
                commit(strokesRef.current.slice(0, -1));
              }}
            >
              <Undo2 className="size-4" /> Annuler
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                send("clear", {});
                commit([]);
              }}
            >
              <Eraser className="size-4" />
            </Button>
          </div>
          <Button
            variant="soft"
            className="mt-3 w-full"
            onClick={() => {
              notifyGame(game, "🎨 Ton dessin est prêt !", `${me.display_name} a fini son dessin, à toi de deviner !`);
              toast(`${nameOf(guesser)} est prévenu·e ✨`, "success");
            }}
          >
            <Send className="size-4" /> J&apos;ai fini, préviens {nameOf(guesser)}
          </Button>
        </>
      )}
      <Guesses game={game} />
      {game.status === "finished" && (
        <p className="mt-3 text-center font-semibold">
          {game.winner === me.id ? `${nameOf(guesser)} a donné sa langue au chat 🐱` : `${nameOf(guesser)} a trouvé ! 🎉`}
        </p>
      )}
    </div>
  );
}

function GuesserView({ game, onChange }: { game: Game; onChange: (g: Game) => void }) {
  const { me, nameOf } = useFamily();
  const toast = useToast();
  const owner = ownerOf(game);
  const persisted = useMemo(() => normalizeStrokes(game.state.strokes), [game.state.strokes]);
  const [pending, setPending] = useState<Stroke[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [live, setLive] = useState<Record<string, Stroke>>({});
  const [clearedAt, setClearedAt] = useState(0);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const active = game.status === "active";

  useDrawingChannel(game.id, {
    live: (s) => setLive((l) => ({ ...l, [s.id]: s })),
    end: (s) => {
      setLive((l) => {
        const next = { ...l };
        delete next[s.id];
        return next;
      });
      setPending((p) => [...p.filter((x) => x.id !== s.id), s]);
    },
    undo: (id) => {
      setRemoved((r) => [...r, id]);
      setPending((p) => p.filter((x) => x.id !== id));
    },
    clear: () => {
      setPending([]);
      setLive({});
      setClearedAt(Date.now());
    },
  });

  // La version enregistrée fait foi : on oublie les traits en attente qu'elle contient déjà.
  const persistedIds = useMemo(() => new Set(persisted.map((s) => s.id)), [persisted]);
  const updatedAt = new Date(game.updated_at).getTime();
  const base = clearedAt > updatedAt ? [] : persisted.filter((s) => !removed.includes(s.id));
  const strokes = [...base, ...pending.filter((s) => !persistedIds.has(s.id))];

  async function propose(e: React.FormEvent) {
    e.preventDefault();
    const guess = value.trim();
    if (!guess || busy || !active) return;
    setBusy(true);
    try {
      const { data, error } = await supabase().rpc("word_guess", { p_game: game.id, p_guess: guess });
      if (error) throw error;
      const res = data as { correct: boolean; word?: string };
      if (res.correct) {
        toast(`🎉 Bravo ! C'était « ${res.word} »`, "success");
        notifyGame(game, `🎨 ${me.display_name} a deviné ton dessin !`, `C'était bien « ${res.word} ». Revanche ?`);
      } else {
        toast("Pas encore… 🤔", "info");
      }
      setValue("");
      const g = await fetchGame(game.id);
      if (g) onChange(g);
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function giveUp() {
    if (!owner) return;
    try {
      const g = await updateGame(game.id, (cur) => (cur.status !== "active" ? null : { status: "finished", winner: owner, turn: null }));
      if (g) {
        onChange(g);
        notifyGame(g, `🎨 ${me.display_name} donne sa langue au chat`, "Viens lui révéler ton mot !");
      }
    } catch (err) {
      toast(errorText(err), "error");
    }
  }

  const hint = typeof game.state.revealed === "string" ? game.state.revealed : "";
  const word = typeof game.state.word === "string" ? game.state.word : null;

  return (
    <div>
      <Canvas strokes={strokes} live={Object.values(live)} drawable={false} />
      {active ? (
        <>
          {hint && (
            <p className="mt-3 text-center font-mono text-xl tracking-[0.3em] text-muted" aria-label={`${hint.replace(/[^_]/g, "").length} lettres`}>
              {hint}
            </p>
          )}
          <form onSubmit={propose} className="mt-3 flex gap-2">
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="C'est un…" autoComplete="off" autoCorrect="off" />
            <Button type="submit" loading={busy} disabled={!value.trim()}>
              Deviner
            </Button>
          </form>
          <button type="button" onClick={giveUp} className="mx-auto mt-3 block text-sm text-muted underline">
            Je donne ma langue au chat 🐱
          </button>
        </>
      ) : (
        <p className="mt-3 text-center font-semibold">
          {word ? (
            <>
              C&apos;était : <span className="uppercase text-accent">{word}</span>
            </>
          ) : (
            `Le mot sera révélé quand ${nameOf(owner)} ouvrira la partie.`
          )}
        </p>
      )}
      <Guesses game={game} />
    </div>
  );
}
