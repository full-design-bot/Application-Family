"use client";

import { Gift, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Field, IconButton, Input, LoadingBlock, Segmented, Sheet, Textarea, cn, useToast } from "@/components/ui";
import { CoquinsPage, notifyCoquin, useSpicyLevel } from "@/components/jeux/coquins/shell";
import { errorText, randomId } from "@/components/jeux/data";
import { BON_EMOJIS, BONS } from "@/content/jeux/bons";
import { useFamily } from "@/lib/family";
import { fromNow } from "@/lib/dates";
import { withinLevel } from "@/lib/jeux/niveau";
import { supabase } from "@/lib/supabase/client";
import type { Coupon } from "@/lib/types";

function CouponCard({ c, children, faded }: { c: Coupon; children?: React.ReactNode; faded?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden rounded-3xl border-2 border-dashed border-rose/50 bg-rose-soft p-4", faded && "opacity-60")}>
      <div className="flex items-start gap-3">
        <span className="text-4xl">{c.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose">Bon pour</p>
          <p className="text-lg font-bold leading-snug">{c.title}</p>
          {c.description && <p className="mt-0.5 text-sm text-muted">{c.description}</p>}
        </div>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function Bons() {
  const { me, partner, nameOf } = useFamily();
  const { level } = useSpicyLevel();
  const toast = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"recus" | "offerts" | "utilises">("recus");
  const [open, setOpen] = useState(false);
  const [emoji, setEmoji] = useState("🎟️");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const models = useMemo(() => withinLevel(BONS, level), [level]);

  const load = useCallback(async () => {
    const { data } = await supabase().from("coupons").select("*").eq("spicy", true).order("created_at", { ascending: false });
    setCoupons((data ?? []) as Coupon[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const sb = supabase();
    const ch = sb
      .channel(`jeux-bons-${randomId()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons" }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [load]);

  async function offer() {
    if (!partner || !title.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase().from("coupons").insert({
        from_id: me.id,
        to_id: partner.id,
        title: title.trim(),
        emoji,
        description: description.trim() || null,
        spicy: true,
      });
      if (error) throw error;
      notifyCoquin("bons");
      toast(`Bon offert à ${partner.display_name} 🎁`, "success");
      setOpen(false);
      setTitle("");
      setDescription("");
      setEmoji("🎟️");
      setTab("offerts");
      load();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function redeem(c: Coupon) {
    const { error } = await supabase().from("coupons").update({ used_at: new Date().toISOString() }).eq("id", c.id);
    if (error) return toast(errorText(error), "error");
    notifyCoquin("bons");
    toast("Bon utilisé ! Profite bien 😏", "success");
    load();
  }

  async function remove(c: Coupon) {
    const { error } = await supabase().from("coupons").delete().eq("id", c.id);
    if (error) return toast(errorText(error), "error");
    load();
  }

  if (loading) return <LoadingBlock />;

  const received = coupons.filter((c) => c.to_id === me.id && !c.used_at);
  const offered = coupons.filter((c) => c.from_id === me.id && !c.used_at);
  const used = coupons.filter((c) => c.used_at);

  return (
    <>
      <Button size="lg" className="mb-4 w-full" onClick={() => setOpen(true)} disabled={!partner}>
        <Gift className="size-5" /> Offrir un bon
      </Button>

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "recus", label: `Reçus${received.length ? ` (${received.length})` : ""}` },
          { value: "offerts", label: "Offerts" },
          { value: "utilises", label: "Utilisés" },
        ]}
      />

      <div className="space-y-3">
        {tab === "recus" &&
          (received.length === 0 ? (
            <EmptyState emoji="🎟️" title="Aucun bon à utiliser" text="Et si tu commençais par en offrir un ? 😉" />
          ) : (
            received.map((c) => (
              <CouponCard key={c.id} c={c}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">
                    De {nameOf(c.from_id)}, {fromNow(c.created_at)}
                  </span>
                  <Button size="sm" onClick={() => redeem(c)}>
                    Utiliser ce bon
                  </Button>
                </div>
              </CouponCard>
            ))
          ))}

        {tab === "offerts" &&
          (offered.length === 0 ? (
            <EmptyState emoji="🎁" title="Aucun bon en attente" text="Les bons que tu offres apparaissent ici jusqu'à ce qu'ils soient utilisés." />
          ) : (
            offered.map((c) => (
              <CouponCard key={c.id} c={c}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">
                    Pour {nameOf(c.to_id)}, {fromNow(c.created_at)} · pas encore utilisé
                  </span>
                  <IconButton label="Reprendre ce bon" onClick={() => remove(c)}>
                    <Trash2 className="size-4 text-muted" />
                  </IconButton>
                </div>
              </CouponCard>
            ))
          ))}

        {tab === "utilises" &&
          (used.length === 0 ? (
            <EmptyState emoji="⏳" title="Aucun bon utilisé" />
          ) : (
            used.map((c) => (
              <CouponCard key={c.id} c={c} faded>
                <span className="text-xs text-muted">
                  {c.to_id === me.id ? `Offert par ${nameOf(c.from_id)}` : `Offert à ${nameOf(c.to_id)}`} · utilisé {fromNow(c.used_at!)}
                </span>
              </CouponCard>
            ))
          ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="🎁 Offrir un bon">
        <div className="space-y-4">
          <div>
            <p className="mb-2 px-1 text-sm font-medium text-muted">Des idées</p>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {models.map((m) => (
                <button
                  key={m.title}
                  type="button"
                  onClick={() => {
                    setEmoji(m.emoji);
                    setTitle(m.title);
                    setDescription(m.description);
                  }}
                  className={cn("w-36 shrink-0 rounded-2xl border p-3 text-left", title === m.title ? "border-accent bg-accent-soft" : "border-line bg-card")}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="mt-1 block text-sm font-semibold leading-tight">{m.title}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 px-1 text-sm font-medium text-muted">Emoji</p>
            <div className="flex flex-wrap gap-1.5">
              {BON_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn("size-10 rounded-xl text-xl", emoji === e ? "bg-accent-soft ring-2 ring-accent" : "bg-card-2")}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <Field label="Bon pour…">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Un massage de 20 minutes" maxLength={80} />
          </Field>
          <Field label="Petit mot (facultatif)">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Valable quand tu veux 😘" maxLength={300} />
          </Field>
          <Card className="p-0">
            <CouponCard c={{ id: "apercu", from_id: me.id, to_id: partner?.id ?? "", title: title || "…", emoji, description: description || null, spicy: true, used_at: null, created_at: "" }} />
          </Card>
          <Button size="lg" className="w-full" onClick={offer} loading={busy} disabled={!title.trim()}>
            Offrir à {partner?.display_name}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

export default function BonsPage() {
  return (
    <CoquinsPage title="🎟️ Bons pour…" subtitle="À offrir, à garder, à utiliser">
      <Bons />
    </CoquinsPage>
  );
}
