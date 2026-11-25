"use client";

// Feuille d'ajout / modification d'un profil enfant (prénom, emoji, couleur, date de naissance).

import { useEffect, useState } from "react";
import { Avatar, Button, Field, Input, Sheet, cn, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { supabase } from "@/lib/supabase/client";
import type { Person } from "@/lib/types";

const COLORS = ["#81b29a", "#3d5a80", "#e07a5f", "#d66b8f", "#f2a65a", "#7b6cd9", "#4aa3a2", "#c9a227"];
const EMOJIS = ["👦", "👧", "🧒", "👶", "🦖", "🦄", "🐻", "🐰", "🦊", "🐱", "🐶", "🐼", "🦁", "🐸", "🚀", "🌈", "⭐", "🌸"];

export function ChildProfileSheet({ open, onClose, child }: { open: boolean; onClose: () => void; child?: Person | null }) {
  const { reload, children } = useFamily();
  const toast = useToast();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [birthdate, setBirthdate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(child?.name ?? "");
    setEmoji(child?.emoji ?? EMOJIS[0]);
    setColor(child?.color ?? COLORS[children.length % COLORS.length]);
    setBirthdate(child?.birthdate ?? "");
  }, [open, child, children.length]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return toast("Quel est son prénom ? ✏️", "error");
    setBusy(true);
    const values = { name: n, emoji: emoji.trim() || "🙂", color, birthdate: birthdate || null };
    const { error } = child
      ? await supabase().from("people").update(values).eq("id", child.id)
      : await supabase()
          .from("people")
          .insert({ ...values, kind: "child", sort_order: children.length + 1 });
    setBusy(false);
    if (error) return toast("Impossible d'enregistrer 😕", "error");
    await reload();
    toast(child ? "Profil mis à jour ✅" : `Bienvenue ${n} ! 🎉`, "success");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={child ? `Modifier ${child.name}` : "Ajouter un enfant"}>
      <form onSubmit={save} className="space-y-4">
        <div className="flex justify-center">
          <Avatar person={{ emoji, color, name }} size={80} />
        </div>
        <Field label="Prénom">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jules" />
        </Field>
        <Field label="Date de naissance">
          <Input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
        </Field>
        <div>
          <span className="mb-1 block px-1 text-sm font-medium text-muted">Emoji</span>
          <div className="grid grid-cols-6 gap-2">
            {EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setEmoji(em)}
                className={cn("flex h-12 items-center justify-center rounded-2xl text-2xl", emoji === em ? "bg-accent-soft ring-2 ring-accent" : "bg-card-2")}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1 block px-1 text-sm font-medium text-muted">Couleur</span>
          <div className="flex flex-wrap gap-3">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Couleur ${c}`}
                onClick={() => setColor(c)}
                className={cn("size-11 rounded-full transition", color === c && "ring-4 ring-ink/30 ring-offset-2 ring-offset-bg")}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {child ? "Enregistrer" : "Ajouter"}
        </Button>
      </form>
    </Sheet>
  );
}
