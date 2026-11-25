"use client";

import { Check, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Field, Input, Sheet, Spinner, Textarea, cn, useToast } from "@/components/ui";
import { formatDateFull, toParisISODate } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import { supabase } from "@/lib/supabase/client";
import type { BucketItem } from "@/lib/types";
import { uniqueChannel } from "./lib";

const EMOJIS = ["✨", "✈️", "🏖️", "🏔️", "🍷", "🍽️", "🎭", "🎢", "🏕️", "🚲", "🎶", "💃", "🧘", "📚", "🌅", "💋"];

/** Liste à vivre (« bucket list ») du couple : ajouter, cocher, compter. */
export function BucketList() {
  const { me } = useFamily();
  const toast = useToast();
  const [items, setItems] = useState<BucketItem[] | null>(null);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [edit, setEdit] = useState<BucketItem | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase().from("bucket_list").select("*").order("created_at");
    setItems((data ?? []) as BucketItem[]);
  }, []);

  useEffect(() => {
    void load();
    const sb = supabase();
    const ch = sb
      .channel(uniqueChannel("couple-bucket"))
      .on("postgres_changes", { event: "*", schema: "public", table: "bucket_list" }, () => void load())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    const { error } = await supabase().from("bucket_list").insert({ title: title.trim(), emoji, created_by: me.id });
    setAdding(false);
    if (error) return toast("Impossible d'ajouter 😕", "error");
    setTitle("");
    setEmoji("✨");
    void load();
  }

  async function toggle(item: BucketItem) {
    const done_at = item.done_at ? null : new Date().toISOString();
    setItems((list) => list?.map((x) => (x.id === item.id ? { ...x, done_at } : x)) ?? null);
    const { error } = await supabase().from("bucket_list").update({ done_at }).eq("id", item.id);
    if (error) {
      toast("Oups 😕", "error");
      void load();
    } else if (done_at) toast(`🎉 ${item.title} — vécu ensemble !`, "success");
  }

  async function saveEdit() {
    if (!edit) return;
    const { error } = await supabase()
      .from("bucket_list")
      .update({ title: edit.title.trim() || "Sans titre", emoji: edit.emoji, notes: edit.notes?.trim() || null })
      .eq("id", edit.id);
    if (error) return toast("Impossible d'enregistrer 😕", "error");
    setEdit(null);
    void load();
  }

  async function remove() {
    if (!edit) return;
    await supabase().from("bucket_list").delete().eq("id", edit.id);
    setEdit(null);
    void load();
  }

  if (items === null) return <Spinner />;
  const todo = items.filter((i) => !i.done_at);
  const done = items.filter((i) => i.done_at).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  return (
    <div className="space-y-3">
      <p className="px-1 font-semibold">
        {done.length === 0
          ? "Votre première aventure vous attend ✨"
          : `🎉 ${done.length} chose${done.length > 1 ? "s" : ""} vécue${done.length > 1 ? "s" : ""} ensemble`}
      </p>

      <form onSubmit={add} className="space-y-2">
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={cn("size-10 shrink-0 rounded-xl text-xl", emoji === e ? "bg-accent-soft ring-2 ring-accent" : "bg-card-2")}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Voir les aurores boréales…" maxLength={120} />
          <Button type="submit" loading={adding} disabled={!title.trim()} aria-label="Ajouter">
            <Plus className="size-5" />
          </Button>
        </div>
      </form>

      <ul className="space-y-2">
        {todo.map((i) => (
          <Row key={i.id} item={i} onToggle={() => toggle(i)} onEdit={() => setEdit(i)} />
        ))}
      </ul>
      {!todo.length && <p className="px-1 text-sm text-muted">Ajoutez vos envies : un voyage, un resto, une folie…</p>}

      {done.length > 0 && (
        <>
          <button type="button" onClick={() => setShowDone(!showDone)} className="px-1 text-sm font-semibold text-muted">
            {showDone ? "▾" : "▸"} Déjà vécu ({done.length})
          </button>
          {showDone && (
            <ul className="space-y-2">
              {done.map((i) => (
                <Row key={i.id} item={i} onToggle={() => toggle(i)} onEdit={() => setEdit(i)} />
              ))}
            </ul>
          )}
        </>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Modifier">
        {edit && (
          <div className="space-y-3">
            <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEdit({ ...edit, emoji: e })}
                  className={cn("size-10 shrink-0 rounded-xl text-xl", edit.emoji === e ? "bg-accent-soft ring-2 ring-accent" : "bg-card-2")}
                >
                  {e}
                </button>
              ))}
            </div>
            <Field label="Envie">
              <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={120} />
            </Field>
            <Field label="Notes">
              <Textarea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder="Où, quand, avec qui…" />
            </Field>
            {edit.done_at && <p className="px-1 text-sm text-muted">Vécu le {formatDateFull(toParisISODate(edit.done_at))} 💛</p>}
            <Button className="w-full" onClick={saveEdit}>
              Enregistrer
            </Button>
            <Button variant="ghost" className="w-full text-danger" onClick={remove}>
              Supprimer
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Row({ item, onToggle, onEdit }: { item: BucketItem; onToggle: () => void; onEdit: () => void }) {
  const done = !!item.done_at;
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-card p-2 pl-3">
      <button
        type="button"
        aria-label={done ? "Marquer comme à vivre" : "Marquer comme vécu"}
        onClick={onToggle}
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition",
          done ? "border-sage bg-sage text-white" : "border-line",
        )}
      >
        {done && <Check className="size-4" strokeWidth={3} />}
      </button>
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
        <span className="text-xl">{item.emoji}</span>
        <span className={cn("min-w-0 flex-1", done && "text-muted line-through")}>
          <span className="block truncate">{item.title}</span>
          {item.notes && <span className="block truncate text-xs text-muted">{item.notes}</span>}
        </span>
      </button>
    </li>
  );
}
