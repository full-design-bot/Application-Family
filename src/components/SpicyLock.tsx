"use client";

import { Lock, ScanFace } from "lucide-react";
import { useEffect, useState } from "react";
import { useFamily } from "@/lib/family";
import { hasBiometricCredential, hashPin, isUnlocked, markUnlocked, verifyBiometric } from "@/lib/lock";
import { Button, Input } from "./ui";

/**
 * Protège un contenu réservé aux parents (jeux coquins) :
 * - refuse l'accès à tout compte non parent ;
 * - demande Face ID (ou le code PIN) si le verrou est activé dans les réglages.
 */
export function SpicyLock({ children }: { children: React.ReactNode }) {
  const { me, isParent } = useFamily();
  const lockEnabled = me.settings?.spicy_lock !== false;
  const pinHash = me.settings?.spicy_pin_hash as string | undefined;
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUnlocked(!lockEnabled || isUnlocked());
  }, [lockEnabled]);

  if (!isParent) {
    return <p className="py-16 text-center text-muted">Cet espace est réservé aux parents.</p>;
  }
  if (unlocked === null) return null;
  if (unlocked) return <>{children}</>;

  const hasBio = hasBiometricCredential();

  async function tryBio() {
    setError(null);
    if (await verifyBiometric()) setUnlocked(true);
    else setError("Déverrouillage annulé.");
  }

  async function tryPin(e: React.FormEvent) {
    e.preventDefault();
    if (pinHash && (await hashPin(pin, me.id)) === pinHash) {
      markUnlocked();
      setUnlocked(true);
    } else setError("Code incorrect.");
  }

  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-rose-soft text-rose">
        <Lock className="size-9" />
      </div>
      <h1 className="text-2xl font-bold">Espace verrouillé</h1>
      <p className="mt-1 text-muted">Rien que pour vous deux 🔥</p>

      <div className="mt-8 w-full max-w-xs space-y-3">
        {hasBio && (
          <Button className="w-full" size="lg" onClick={tryBio}>
            <ScanFace className="size-5" /> Déverrouiller avec Face ID
          </Button>
        )}
        {pinHash ? (
          <form onSubmit={tryPin} className="space-y-2">
            <Input
              inputMode="numeric"
              type="password"
              placeholder="Code à 4 chiffres"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="text-center tracking-[0.5em]"
              maxLength={8}
            />
            <Button type="submit" variant="secondary" className="w-full">
              Valider le code
            </Button>
          </form>
        ) : (
          !hasBio && (
            <Button className="w-full" onClick={() => { markUnlocked(); setUnlocked(true); }}>
              Entrer
            </Button>
          )
        )}
        {!hasBio && !pinHash && (
          <p className="text-sm text-muted">Configure Face ID ou un code dans Plus → Réglages pour verrouiller cet espace.</p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
