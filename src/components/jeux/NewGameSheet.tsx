"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Segmented, Sheet, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { GAME_META, newGameRow, type GameType } from "@/lib/jeux/games";
import { createGame, errorText, gameUrl, notifyGame } from "./data";

const RULES: Record<GameType, string> = {
  morpion: "Chacun son tour, pose ton symbole. Le premier qui en aligne trois a gagné.",
  alignes4: "Lâche tes jetons dans la grille de 7 × 6. Aligne-en quatre (ligne, colonne ou diagonale) avant l'autre !",
  bataille: "Place tes 5 bateaux en secret, puis tirez chacun votre tour. Touché ? Tu rejoues !",
  pendu: "L'un choisit un mot secret, l'autre le devine lettre par lettre. Sept erreurs et le pendu est complet.",
  dessin: "L'un reçoit un mot au hasard et le dessine, l'autre voit le dessin se faire en direct et devine.",
};

export function NewGameSheet({ type, onClose }: { type: GameType | null; onClose: () => void }) {
  const { me, partner } = useFamily();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<"me" | "partner">("me");
  const meta = type ? GAME_META[type] : null;
  const wordGame = type === "pendu" || type === "dessin";

  async function start() {
    if (!type || !partner) return;
    setBusy(true);
    try {
      const row = newGameRow(type, me.id, partner.id, wordGame ? { owner: role === "me" ? me.id : partner.id } : {});
      const g = await createGame(row);
      if (type === "bataille") {
        notifyGame(g, "⚓ Nouvelle bataille navale !", `${me.display_name} te défie : place tes bateaux !`);
      } else if (wordGame && role === "partner") {
        notifyGame(
          g,
          `${GAME_META[type].emoji} ${GAME_META[type].label}`,
          type === "dessin" ? `${me.display_name} veut deviner ton dessin : à toi de dessiner !` : `${me.display_name} t'attend : choisis un mot secret !`,
        );
      }
      router.push(gameUrl(g.id));
    } catch (e) {
      toast(errorText(e), "error");
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!type} onClose={onClose} title={meta ? `${meta.emoji} ${meta.label}` : ""}>
      {type && (
        <div className="space-y-4">
          <p className="text-muted">{RULES[type]}</p>
          {!partner ? (
            <p className="rounded-2xl bg-card-2 p-3 text-sm">L&apos;autre parent doit d&apos;abord se connecter une première fois pour jouer avec toi.</p>
          ) : (
            <>
              {wordGame && (
                <Segmented
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: "me", label: type === "dessin" ? "Je dessine ✏️" : "Je choisis le mot 🤫" },
                    { value: "partner", label: "Je devine 🤔" },
                  ]}
                />
              )}
              <Button size="lg" className="w-full" onClick={start} loading={busy}>
                Lancer la partie avec {partner.display_name}
              </Button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
