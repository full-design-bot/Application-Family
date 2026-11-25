"use client";

import { useParams, useRouter } from "next/navigation";
import { Check, MoreHorizontal, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, EmptyState, Field, IconButton, Input, LinkButton, LoadingBlock, PageHeader, Sheet, cn, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { supabase } from "@/lib/supabase/client";
import type { List, ListItem } from "@/lib/types";

export default function ListPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useFamily();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [list, setList] = useState<List | null | undefined>(undefined);
  const [items, setItems] = useState<ListItem[]>([]);
  const [text, setText] = useState("");
  const [options, setOptions] = useState(false);
  const [rename, setRename] = useState("");

  const load = useCallback(async () => {
    const sb = supabase();
    const [{ data: l }, { data: its }] = await Promise.all([
      sb.from("lists").select("*").eq("id", id).maybeSingle(),
      sb.from("list_items").select("*").eq("list_id", id).order("created_at", { ascending: false }),
    ]);
    setList((l as List | null) ?? null);
    setItems((its ?? []) as ListItem[]);
  }, [id]);

  useEffect(() => {
    load();
    const sb = supabase();
    const ch = sb
      .channel(`listes-items-${id}-${Math.random().toString(36).slice(2, 10)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "list_items" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "lists" }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [id, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const lines = text
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lines.length) return;
    setText("");
    inputRef.current?.focus();
    const rows = lines.map((t) => ({ list_id: id, text: t, created_by: me.id }));
    const { data, error } = await supabase().from("list_items").insert(rows).select("*");
    if (error) {
      setText(lines.join("\n"));
      return toast("Impossible d'ajouter 😕", "error");
    }
    setItems((prev) => [...((data ?? []) as ListItem[]).reverse(), ...prev.filter((p) => !(data ?? []).some((d) => d.id === p.id))]);
  }

  async function toggle(item: ListItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    const { error } = await supabase().from("list_items").update({ done: !item.done }).eq("id", item.id);
    if (error) {
      toast("Oups, pas enregistré", "error");
      load();
    }
  }

  async function removeItem(item: ListItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await supabase().from("list_items").delete().eq("id", item.id);
  }

  async function clearDone() {
    const done = items.filter((i) => i.done);
    if (!done.length) return;
    setItems((prev) => prev.filter((i) => !i.done));
    const { error } = await supabase().from("list_items").delete().eq("list_id", id).eq("done", true);
    if (error) {
      toast("Impossible de vider", "error");
      load();
    } else toast(`${done.length} élément${done.length > 1 ? "s" : ""} retiré${done.length > 1 ? "s" : ""} 🧹`, "success");
  }

  async function saveTitle() {
    const t = rename.trim();
    if (!t || !list) return;
    await supabase().from("lists").update({ title: t }).eq("id", list.id);
    setOptions(false);
    load();
  }

  async function deleteList() {
    if (!list || !window.confirm(`Supprimer la liste « ${list.title} » et tout son contenu ?`)) return;
    const { error } = await supabase().from("lists").delete().eq("id", list.id);
    if (error) return toast("Impossible de supprimer", "error");
    toast("Liste supprimée", "success");
    router.push("/listes");
  }

  if (list === undefined) return <LoadingBlock />;
  if (list === null) {
    return (
      <>
        <PageHeader title="Listes" back="/listes" />
        <EmptyState emoji="🫥" title="Cette liste n'existe plus" action={<LinkButton href="/listes">Retour aux listes</LinkButton>} />
      </>
    );
  }

  const todo = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <>
      <PageHeader
        title={`${list.emoji} ${list.title}`}
        subtitle={todo.length ? `${todo.length} à prendre` : items.length ? "Tout est coché ✅" : undefined}
        back="/listes"
        action={
          <IconButton
            label="Options de la liste"
            onClick={() => {
              setRename(list.title);
              setOptions(true);
            }}
            className="border border-line bg-card"
          >
            <MoreHorizontal className="size-5" />
          </IconButton>
        }
      />

      <form onSubmit={add} className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ajouter… (lait, pain, piles)"
            enterKeyHint="done"
            autoComplete="off"
            className="h-12 w-full rounded-2xl border border-line bg-card px-4 py-3 text-ink outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <Button type="submit" className="h-12 w-12 shrink-0 px-0" aria-label="Ajouter" disabled={!text.trim()}>
            <Plus className="size-6" />
          </Button>
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState emoji="🧺" title="La liste est vide" text="Ajoute un premier élément juste au-dessus." />
      ) : (
        <div className="space-y-1.5">
          {todo.map((i) => (
            <Row key={i.id} item={i} onToggle={() => toggle(i)} onDelete={() => removeItem(i)} />
          ))}
          {done.length > 0 && (
            <>
              <div className="flex items-center justify-between px-1 pb-1 pt-4">
                <span className="text-sm font-semibold uppercase tracking-wide text-muted">Cochés ({done.length})</span>
                <Button variant="ghost" size="sm" onClick={clearDone} className="text-accent">
                  🧹 Vider les cochés
                </Button>
              </div>
              {done.map((i) => (
                <Row key={i.id} item={i} onToggle={() => toggle(i)} onDelete={() => removeItem(i)} />
              ))}
            </>
          )}
        </div>
      )}

      <Sheet open={options} onClose={() => setOptions(false)} title="Options de la liste">
        <div className="space-y-3">
          <Field label="Nom">
            <Input value={rename} onChange={(e) => setRename(e.target.value)} />
          </Field>
          <Button className="w-full" onClick={saveTitle}>
            Renommer
          </Button>
          <Button variant="secondary" className="w-full text-danger" onClick={deleteList}>
            Supprimer la liste
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function Row({ item, onToggle, onDelete }: { item: ListItem; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className={cn("flex items-center gap-1 rounded-2xl border border-line bg-card pr-1 transition", item.done && "bg-card-2")}>
      <button type="button" onClick={onToggle} className="flex min-h-12 flex-1 items-center gap-3 px-3 py-2 text-left" aria-pressed={item.done}>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition", item.done ? "border-sage bg-sage text-white" : "border-line")}>
          {item.done && <Check className="size-4" strokeWidth={3} />}
        </span>
        <span className={cn("break-words", item.done && "text-muted line-through")}>{item.text}</span>
      </button>
      <button type="button" aria-label="Retirer" onClick={onDelete} className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted active:bg-card-2">
        <X className="size-4" />
      </button>
    </div>
  );
}
