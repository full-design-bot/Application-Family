"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Button, Chip, EmptyState, Field, Input, LoadingBlock, PageHeader, Sheet, useToast } from "@/components/ui";
import { uniqueChannel } from "@/components/couple/lib";
import { fromNow } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import { useSignedUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase/client";
import type { Drawing, Person } from "@/lib/types";

type DrawingListItem = Pick<Drawing, "id" | "title" | "preview_path" | "person_id" | "created_by" | "updated_at">;

export default function DessinsPage() {
  const { me, children, personById } = useFamily();
  const router = useRouter();
  const toast = useToast();
  const [list, setList] = useState<DrawingListItem[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [personId, setPersonId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase()
      .from("drawings")
      .select("id, title, preview_path, person_id, created_by, updated_at")
      .order("updated_at", { ascending: false });
    setList((data ?? []) as DrawingListItem[]);
  }, []);

  useEffect(() => {
    void load();
    const sb = supabase();
    const ch = sb
      .channel(uniqueChannel("dessin-mur"))
      .on("postgres_changes", { event: "*", schema: "public", table: "drawings" }, () => void load())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [load]);

  async function create() {
    setBusy(true);
    const { data, error } = await supabase()
      .from("drawings")
      .insert({ title: title.trim() || "Dessin", person_id: personId, created_by: me.id })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      toast("Impossible de créer le dessin 😕", "error");
      return;
    }
    router.push(`/dessin/${data.id}`);
  }

  const shown = (list ?? []).filter((d) => (filter === "all" ? true : filter === "us" ? !d.person_id : d.person_id === filter));

  return (
    <>
      <PageHeader
        title="Dessins 🎨"
        subtitle="Dessinez à deux, en direct"
        back="/plus"
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Nouveau
          </Button>
        }
      />

      {children.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            Tous
          </Chip>
          <Chip active={filter === "us"} onClick={() => setFilter("us")}>
            💑 Nous
          </Chip>
          {children.map((c) => (
            <Chip key={c.id} active={filter === c.id} color={c.color} onClick={() => setFilter(c.id)}>
              {c.emoji} {c.name}
            </Chip>
          ))}
        </div>
      )}

      {list === null ? (
        <LoadingBlock />
      ) : shown.length === 0 ? (
        <EmptyState
          emoji="🖍️"
          title="Le mur est encore vide"
          text="Lance un tableau et invite l'autre à dessiner avec toi : vous verrez vos traits apparaître en direct."
          action={<Button onClick={() => setCreating(true)}>Commencer un dessin</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {shown.map((d) => (
            <DrawingTile key={d.id} d={d} person={personById(d.person_id)} />
          ))}
        </div>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="🎨 Nouveau dessin">
        <div className="space-y-4">
          <Field label="Titre">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notre maison de rêve" maxLength={60} />
          </Field>
          {children.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-sm font-medium text-muted">C&apos;est le dessin de…</p>
              <div className="flex flex-wrap gap-2">
                <Chip active={!personId} onClick={() => setPersonId(null)}>
                  💑 Nous deux
                </Chip>
                {children.map((c) => (
                  <Chip key={c.id} active={personId === c.id} color={c.color} onClick={() => setPersonId(c.id)}>
                    {c.emoji} {c.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <Button className="w-full" size="lg" loading={busy} onClick={create}>
            Commencer à dessiner
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function DrawingTile({ d, person }: { d: DrawingListItem; person?: Person }) {
  const url = useSignedUrl(d.preview_path);
  return (
    <Link href={`/dessin/${d.id}`} className="block overflow-hidden rounded-3xl border border-line bg-card transition active:scale-[0.98]">
      <div className="flex aspect-[3/4] items-center justify-center bg-[#fffdf8]">
        {url ? <img src={url} alt="" className="size-full object-cover" /> : <span className="text-4xl opacity-60">🎨</span>}
      </div>
      <div className="flex items-center gap-2 p-2.5">
        {person && <Avatar person={person} size={24} />}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{d.title}</p>
          <p className="truncate text-xs text-muted">{fromNow(d.updated_at)}</p>
        </div>
      </div>
    </Link>
  );
}
