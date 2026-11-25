import { describe, expect, it } from "vitest";
import { canPlace, FLEET, fleetStatus, isFleetValid, placeShip, randomFleet, shipCells, shotsOf, cellName } from "./bataille";
import { cleanWord, letterStatus, maskWord, normalizeWord, sameWord, validateWord } from "./mots";
import { effectiveLevel, levelOfSettings, withinLevel } from "./niveau";
import { hashSeed, pick, pickDifferent, seededRng, shuffle } from "./random";
import { computeComplicity, type PairedRowLite } from "./complicite";
import { isMyTurn, newGameRow, rematchRow, resultFor, statusLine, victories, type GameLike } from "./games";
import { clampPoint, strokePath, thinPoints } from "./dessin";

describe("bataille navale", () => {
  it("calcule les cases d'un bateau et refuse de sortir de la grille", () => {
    expect(shipCells(0, 3, true)).toEqual([0, 1, 2]);
    expect(shipCells(0, 3, false)).toEqual([0, 10, 20]);
    expect(shipCells(8, 3, true)).toBeNull();
    expect(shipCells(80, 3, false)).toBeNull();
    expect(shipCells(70, 3, false)).toEqual([70, 80, 90]);
    expect(cellName(0)).toBe("A1");
    expect(cellName(99)).toBe("J10");
  });

  it("interdit les chevauchements mais permet de déplacer un bateau", () => {
    const ships = placeShip([], FLEET[0], 0, true)!;
    expect(canPlace(ships, [4, 14])).toBe(false);
    expect(canPlace(ships, [5, 15])).toBe(true);
    const moved = placeShip(ships, FLEET[0], 2, true);
    expect(moved?.[0].cells).toEqual([2, 3, 4, 5, 6]);
  });

  it("place une flotte aléatoire valide (5-4-3-3-2)", () => {
    for (let s = 1; s <= 30; s++) {
      const fleet = randomFleet(seededRng(s));
      expect(isFleetValid(fleet)).toBe(true);
      expect(fleet.map((f) => f.size).sort()).toEqual([2, 3, 3, 4, 5]);
    }
  });

  it("refuse une flotte incomplète ou tordue", () => {
    const fleet = randomFleet(seededRng(3));
    expect(isFleetValid(fleet.slice(1))).toBe(false);
    const broken = fleet.map((s) => (s.size === 2 ? { ...s, cells: [9, 10] } : s));
    expect(isFleetValid(broken)).toBe(false);
  });

  it("lit les tirs et l'état de ma flotte", () => {
    const state = { shots: { a: [{ cell: 0, hit: true }, { cell: 1, hit: true, sunk: true }, { cell: 50, hit: false }] } };
    const shots = shotsOf(state, "a");
    expect(shots).toHaveLength(3);
    expect(shotsOf(state, "b")).toEqual([]);
    const status = fleetStatus([{ id: "torpilleur", size: 2, cells: [0, 1] }], shots);
    expect(status[0].sunk).toBe(true);
  });
});

describe("mots", () => {
  it("normalise comme la base", () => {
    expect(normalizeWord("Éléphant")).toBe("ELEPHANT");
    expect(normalizeWord("garçon")).toBe("GARCON");
    expect(sameWord(" chÂteau ", "CHATEAU")).toBe(true);
    expect(cleanWord("  arc   en ciel ")).toBe("ARC EN CIEL");
  });

  it("valide les mots", () => {
    expect(validateWord("chat")).toBeNull();
    expect(validateWord("arc-en-ciel")).toBeNull();
    expect(validateWord("ok")).not.toBeNull();
    expect(validateWord("bœuf")).not.toBeNull();
    expect(validateWord("abc123")).not.toBeNull();
  });

  it("colore les touches", () => {
    expect(letterStatus("E", "_LÉ____", ["E", "L", "Z"])).toBe("hit");
    expect(letterStatus("Z", "_LÉ____", ["E", "L", "Z"])).toBe("miss");
    expect(letterStatus("A", "_LÉ____", ["E", "L", "Z"])).toBe("untried");
    expect(maskWord("ARC-EN-CIEL")).toBe("___-__-____");
  });
});

describe("niveaux coquins", () => {
  it("prend le plus prudent des deux", () => {
    expect(effectiveLevel(3, 2)).toBe(2);
    expect(effectiveLevel(1, 3)).toBe(1);
    expect(effectiveLevel(3, undefined)).toBe(1);
    expect(effectiveLevel("3", 3)).toBe(3);
    expect(levelOfSettings({})).toBe(1);
    expect(levelOfSettings({ spicy_max_level: 2 })).toBe(2);
  });

  it("ne garde rien au-dessus du niveau", () => {
    const items = [{ level: 1 as const }, { level: 2 as const }, { level: 3 as const }];
    expect(withinLevel(items, 2)).toHaveLength(2);
    expect(withinLevel(items, 1).every((i) => i.level === 1)).toBe(true);
  });
});

describe("hasard", () => {
  it("est reproductible avec une graine", () => {
    const a = shuffle([1, 2, 3, 4, 5, 6], seededRng(hashSeed("x")));
    const b = shuffle([1, 2, 3, 4, 5, 6], seededRng(hashSeed("x")));
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect([1, 2, 3]).toContain(pick([1, 2, 3]));
    for (let i = 0; i < 20; i++) expect(pickDifferent([1, 2], 1)).toBe(2);
  });
});

describe("complicité", () => {
  const row = (game: string, key: string, member: string, answer: unknown, guess: unknown = null, at = "2026-10-01T10:00:00Z"): PairedRowLite => ({
    game,
    item_key: key,
    member_id: member,
    answer,
    guess,
    created_at: at,
  });

  it("compte les bonnes devinettes, les accords et ignore les questions à moitié répondues", () => {
    const rows = [
      row("devine", "d1", "me", 0, 1),
      row("devine", "d1", "sam", 1, 2), // je devine juste, Sam se trompe
      row("qui", "q1", "me", "sam"),
      row("qui", "q1", "sam", "sam"), // d'accord
      row("tupreferes", "t1", "me", "a", null, "2026-11-02T10:00:00Z"),
      row("tupreferes", "t1", "sam", "b", null, "2026-11-03T10:00:00Z"), // pas d'accord
      row("tupreferes", "t2", "me", "a"), // Sam n'a pas répondu
      row("36q", "x", "me", { text: "…" }),
      row("36q", "x", "sam", { text: "…" }),
    ];
    const r = computeComplicity(rows, "me", "sam");
    expect(r.pairs).toBe(3);
    expect(r.byGame.devine).toEqual({ matches: 1, total: 2, pct: 50 });
    expect(r.byGame.qui.pct).toBe(100);
    expect(r.byGame.tupreferes.pct).toBe(0);
    expect(r.global).toEqual({ matches: 2, total: 4, pct: 50 });
    expect(r.devinePoints).toEqual({ me: 1, sam: 0 });
    expect(r.timeline.map((t) => t.month)).toEqual(["2026-10", "2026-11"]);
    expect(r.timeline[1].cumulativePct).toBe(50);
  });

  it("renvoie un score vide sans partenaire", () => {
    expect(computeComplicity([row("qui", "q", "me", "me")], "me", null).global.pct).toBeNull();
  });
});

describe("parties", () => {
  const base = (over: Partial<GameLike>): GameLike => ({
    id: "g",
    type: "morpion",
    state: {},
    players: ["me", "sam"],
    turn: "me",
    status: "active",
    winner: null,
    ...over,
  });

  it("sait à qui c'est le tour", () => {
    expect(isMyTurn(base({}), "me")).toBe(true);
    expect(isMyTurn(base({}), "sam")).toBe(false);
    expect(isMyTurn(base({ status: "finished" }), "me")).toBe(false);
    const setup = base({ type: "bataille", status: "setup", state: { ready: ["me"] } });
    expect(isMyTurn(setup, "me")).toBe(false);
    expect(isMyTurn(setup, "sam")).toBe(true);
    const pendu = base({ type: "pendu", status: "setup", turn: "sam", state: { owner: "me" } });
    expect(isMyTurn(pendu, "me")).toBe(true);
    expect(isMyTurn({ ...pendu, status: "active" }, "me")).toBe(false);
    expect(isMyTurn({ ...pendu, status: "active" }, "sam")).toBe(true);
    expect(isMyTurn(base({}), "intrus")).toBe(false);
  });

  it("crée des parties cohérentes", () => {
    const m = newGameRow("morpion", "me", "sam");
    expect(m.turn).toBe("me");
    expect(m.status).toBe("active");
    const b = newGameRow("bataille", "me", "sam");
    expect(b.status).toBe("setup");
    const p = newGameRow("pendu", "me", "sam");
    expect(p.state.owner).toBe("me");
    expect(p.turn).toBe("sam");
  });

  it("alterne à la revanche", () => {
    const g = base({ status: "finished", state: { first: "me" } });
    expect(rematchRow(g, "me")?.turn).toBe("sam");
    expect(rematchRow(g, "sam")?.turn).toBe("sam");
    const d = base({ type: "dessin", status: "finished", state: { owner: "me" } });
    expect(rematchRow(d, "me")?.state.owner).toBe("sam");
    expect(rematchRow(d, "me")?.status).toBe("setup");
    expect(rematchRow(d, "sam")?.state.owner).toBe("sam");
  });

  it("résultats, statut et victoires", () => {
    const won = base({ status: "finished", winner: "me" });
    expect(resultFor(won, "me")).toBe("win");
    expect(resultFor(won, "sam")).toBe("loss");
    expect(resultFor(base({ status: "finished" }), "me")).toBe("draw");
    expect(statusLine(base({ turn: "sam" }), "me", () => "Sam")).toBe("Au tour de Sam");
    const v = victories([won, base({ status: "finished", winner: "sam" }), base({ status: "finished", winner: "me", type: "pendu" }), base({})], ["me", "sam"]);
    expect(v.total).toEqual({ me: 2, sam: 1 });
    expect(v.byType.pendu.me).toBe(1);
  });
});

describe("dessin", () => {
  it("borne les points et allège les traits", () => {
    expect(clampPoint(-5, 2000.4)).toEqual([0, 1000]);
    const pts: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [10, 0],
      [11, 0],
    ];
    expect(thinPoints(pts)).toEqual([
      [0, 0],
      [10, 0],
      [11, 0],
    ]);
    expect(strokePath({ points: pts, size: 16 })).toMatch(/^M/);
  });
});

describe("dé coquin", () => {
  it("accorde les prépositions", async () => {
    const { combineDice } = await import("./niveau");
    expect(combineDice("Murmure un compliment près de", "le cou")).toBe("Murmure un compliment près du cou");
    expect(combineDice("Murmure un compliment près de", "les mains")).toBe("Murmure un compliment près des mains");
    expect(combineDice("Embrasse", "l'oreille", "sous la couette")).toBe("Embrasse l'oreille, sous la couette");
  });
});
