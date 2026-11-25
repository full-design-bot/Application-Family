"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, Field, Input, LoadingBlock, PageHeader, Segmented, Sheet, cn, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { notify } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";
import type { List, Space } from "@/lib/types";

const LIST_EMOJIS = ["🛒", "🎁", "🎒", "🧳", "🎄", "🎂", "📚", "🏡", "🍰", "💊", "🧸", "🌱", "🎬", "✨", "📝"];
const IDEAS = [
  { emoji: "🛒", title: "Courses" },
  { emoji: "🎁", title: "Idées cadeaux" },
  { emoji: "🎒", title: "Rentrée" },
  { emoji: "🧳", title: "Valise des vacances" },
];

type ListWithCount = List & { list_items: { done: boolean }[] };

export default function ListesPage() {
  const { me, isParent } = useFamily();
  const toast = useToast();
  const [lists, setLists] = useState<ListWithCount[] | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🛒");
  const [space, setSpace] = useState<Space>("family");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase().from("lists").select("*, list_items(done)").order("sort_order").order("created_at");
    if (error) toast("Impossible de charger les listes 😕", "error");
    setLists((data ?? []) as ListWithCount[]);
  }, [toast]);

  useEffect(() => {
    load();
    const sb = supabase();
    const ch = sb
      .channel(`listes-index-${Math.random().toString(36).slice(2, 10)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lists" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "list_items" }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [load]);

  function openNew(preset?: { emoji: string; title: string }) {
    setTitle(preset?.title ?? "");
    setEmoji(preset?.emoji ?? "🛒");
    setSpace("family");
    setOpen(true);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return toast("Donne un nom à la liste ✏️", "error");
    setBusy(true);
    const { data, error } = await supabase()
      .from("lists")
      .insert({ title: t, emoji, space, created_by: me.id, sort_order: lists?.length ?? 0 })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return toast("Impossible de créer la liste 😕", "error");
    notify({ title: `${emoji} Nouvelle liste : ${t}`, body: `${me.display_name} l'a créée`, url: `/listes/${data.id}`, tag: `list-${data.id}` });
    setOpen(false);
    load();
  }

  return (
    <>
      <PageHeader
        title="Listes"
        subtitle="Courses, cadeaux, rentrée…"
        back="/plus"
        action={
          <button type="button" onClick={() => openNew()} aria-label="Nouvelle liste" className="inline-flex size-11 items-center justify-center rounded-full bg-accent text-accent-ink shadow-sm">
            <Plus className="size-6" />
          </button>
        }
      />

      {lists === null ? (
        <LoadingBlock />
      ) : lists.length === 0 ? (
        <>
          <EmptyState emoji="📝" title="Aucune liste pour l'instant" text="Une liste partagée, cochée en direct par vous deux." />
          <div className="grid grid-cols-2 gap-2">
            {IDEAS.map((i) => (
              <button key={i.title} type="button" onClick={() => openNew(i)} className="rounded-3xl bg-card-2 p-4 text-left active:scale-[0.98] transition">
                <span className="text-2xl">{i.emoji}</span>
                <span className="mt-1 block font-semibold">{i.title}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {lists.map((l) => {
            const left = l.list_items.filter((i) => !i.done).length;
            const total = l.list_items.length;
            return (
              <Link key={l.id} href={`/listes/${l.id}`} className={cn("rounded-3xl border border-line bg-card p-4 active:scale-[0.98] transition", l.space === "couple" && "border-rose/40 bg-rose-soft")}>
                <span className="text-3xl">{l.emoji}</span>
                <span className="mt-2 block font-bold leading-tight">{l.title}</span>
                <span className="mt-0.5 block text-sm text-muted">
                  {total === 0 ? "Vide" : left === 0 ? "Tout est coché ✅" : `${left} à prendre`}
                  {l.space === "couple" && " · 💑"}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Nouvelle liste">
        <form onSubmit={create} className="space-y-4">
          <Field label="Nom">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Courses de la semaine" autoFocus />
          </Field>
          <div>
            <span className="mb-1 block px-1 text-sm font-medium text-muted">Emoji</span>
            <div className="grid grid-cols-8 gap-1.5">
              {LIST_EMOJIS.map((em) => (
                <button key={em} type="button" onClick={() => setEmoji(em)} className={cn("flex h-11 items-center justify-center rounded-xl text-xl", emoji === em ? "bg-accent-soft ring-2 ring-accent" : "bg-card-2")}>
                  {em}
                </button>
              ))}
            </div>
          </div>
          {isParent && (
            <Segmented
              value={space}
              onChange={setSpace}
              options={[
                { value: "family", label: "👨‍👩‍👧‍👦 Famille" },
                { value: "couple", label: "💑 Rien que nous deux" },
              ]}
            />
          )}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Créer la liste
          </Button>
        </form>
      </Sheet>
    </>
  );
}
