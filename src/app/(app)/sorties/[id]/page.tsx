"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PlaceVisual, RatingsRow, SpaceBadge, StarPicker, Stars } from "@/components/sorties/PlaceBits";
import { PlaceForm, rowFromValues, valuesFromPlace, type PlaceFormValues } from "@/components/sorties/PlaceForm";
import { PlacesMap } from "@/components/sorties/PlacesMap";
import { useParentIds, usePlace } from "@/components/sorties/data";
import { Avatar, Button, Card, EmptyState, IconButton, LinkButton, LoadingBlock, PageHeader, Sheet, useToast } from "@/components/ui";
import { fromNow } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import { categoryMeta } from "@/lib/places/categories";
import { agendaUrl, appleMapsUrl, fullAddress, instagramUrl, priceLabel, ratingsAgreement } from "@/lib/places/links";
import { notify } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";
import type { Place } from "@/lib/types";

export default function PlacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { me, partner, isParent, nameOf, personOf } = useFamily();
  const parentIds = useParentIds();
  const { place, loading, setPlace } = usePlace(id);
  const [editing, setEditing] = useState<PlaceFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);

  if (loading) {
    return (
      <>
        <PageHeader title="Sortie" back="/sorties" />
        <LoadingBlock />
      </>
    );
  }
  if (!place) {
    return (
      <>
        <PageHeader title="Sortie" back="/sorties" />
        <EmptyState emoji="🤷" title="Ce lieu n'existe plus" action={<LinkButton href="/sorties">Retour aux sorties</LinkButton>} />
      </>
    );
  }

  const meta = categoryMeta(place.category);
  const price = priceLabel(place.price_level);
  const address = fullAddress(place);
  const hasCoords = place.lat !== null && place.lng !== null;
  const myRating = place.ratings?.[me.id] ?? null;
  const partnerRating = partner ? place.ratings?.[partner.id] ?? null : null;
  const agreement = ratingsAgreement(place.ratings ?? {}, parentIds);

  async function update(patch: Partial<Place>) {
    const { data, error } = await supabase().from("places").update(patch).eq("id", place!.id).select("*").single();
    if (error || !data) {
      toast("Oups, la modification a échoué.", "error");
      return null;
    }
    setPlace(data as Place);
    return data as Place;
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    const ok = await update(rowFromValues(editing));
    setSaving(false);
    if (ok) {
      setEditing(null);
      toast("Modifié ✅", "success");
    }
  }

  async function remove() {
    if (!confirm(`Supprimer « ${place!.name} » ?`)) return;
    const { error } = await supabase().from("places").delete().eq("id", place!.id);
    if (error) {
      toast("Suppression impossible.", "error");
      return;
    }
    toast("Supprimé 🗑️");
    router.replace("/sorties");
  }

  /** Enregistre ma note (en relisant les notes à jour pour ne pas écraser celle de l'autre) */
  async function rate(n: number) {
    const { data: fresh } = await supabase().from("places").select("ratings, status").eq("id", place!.id).single();
    const ratings = { ...((fresh?.ratings as Record<string, number>) ?? place!.ratings ?? {}), [me.id]: n };
    const firstTime = (fresh?.status ?? place!.status) !== "done";
    const saved = await update({ ratings, status: "done", done_at: firstTime ? new Date().toISOString() : place!.done_at });
    if (!saved) return;
    if (firstTime) {
      notify({
        title: `✅ ${saved.name} : testé !`,
        body: `${me.display_name} a mis ${"★".repeat(n)}. Et toi, tu mets combien ?`,
        url: `/sorties/${saved.id}`,
        tag: `sortie-note-${saved.id}`,
      });
    } else if (partner && typeof ratings[partner.id] !== "number") {
      notify({ title: `⭐ ${saved.name}`, body: `${me.display_name} a noté ${n}/5. À toi !`, url: `/sorties/${saved.id}`, tag: `sortie-note-${saved.id}` });
    }
  }

  async function markTodo() {
    await update({ status: "todo", done_at: null });
    toast("Remis dans « À tester » 🔖");
  }

  return (
    <>
      <PageHeader
        title={place.name}
        back="/sorties"
        action={
          <div className="flex">
            <IconButton label="Modifier" onClick={() => setEditing(valuesFromPlace(place))}>
              <Pencil className="size-5" />
            </IconButton>
            <IconButton label="Supprimer" onClick={remove} className="text-danger">
              <Trash2 className="size-5" />
            </IconButton>
          </div>
        }
      />

      <PlaceVisual place={place} className="h-52 rounded-3xl" emojiSize="text-7xl" />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-card-2 px-2.5 py-0.5 text-sm font-semibold">
          {meta.emoji} {meta.single}
        </span>
        <SpaceBadge space={place.space} />
        {price && <span className="rounded-full bg-card-2 px-2.5 py-0.5 text-sm font-semibold">{price}</span>}
        {place.status === "done" ? (
          <span className="rounded-full bg-sage-soft px-2.5 py-0.5 text-sm font-semibold text-sage">✅ Testé</span>
        ) : (
          <span className="rounded-full bg-sand-soft px-2.5 py-0.5 text-sm font-semibold">🔖 À tester</span>
        )}
      </div>

      {address && <p className="mt-3 text-muted">📍 {address}</p>}
      {place.description && <p className="mt-2 leading-relaxed">{place.description}</p>}
      {place.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {place.tags.map((t) => (
            <span key={t} className="rounded-full bg-card-2 px-2.5 py-1 text-sm text-muted">
              #{t}
            </span>
          ))}
        </div>
      )}
      {place.notes && (
        <Card className="mt-3 bg-sand-soft">
          <p className="text-sm font-semibold text-muted">📝 Notes</p>
          <p className="mt-1 whitespace-pre-line">{place.notes}</p>
        </Card>
      )}

      {/* Actions principales */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {place.status === "todo" ? (
          <Button onClick={() => setRateOpen(true)} variant="primary">
            ✅ On l&apos;a testé
          </Button>
        ) : (
          <Button onClick={() => setRateOpen(true)} variant="soft">
            ⭐ {myRating ? "Changer ma note" : "Mettre ma note"}
          </Button>
        )}
        <LinkButton href={agendaUrl(place)} variant="secondary">
          📅 On y va
        </LinkButton>
      </div>

      {/* Notes des deux */}
      {place.status === "done" && (
        <Card className="mt-4 space-y-3">
          <p className="font-semibold">Vos notes</p>
          {parentIds.length > 0 && Object.keys(place.ratings ?? {}).length > 0 ? (
            <RatingsRow place={place} parentIds={parentIds} />
          ) : (
            <p className="text-sm text-muted">Pas encore de note.</p>
          )}
          {agreement === "agree" && <p className="rounded-2xl bg-sage-soft px-3 py-2 font-semibold">🤝 Vous êtes d&apos;accord !</p>}
          {agreement === "disagree" && <p className="rounded-2xl bg-rose-soft px-3 py-2 text-sm">😅 Avis partagés… il faudra y retourner pour trancher !</p>}
          {partner && partnerRating === null && myRating !== null && (
            <p className="text-sm text-muted">En attente de la note de {partner.display_name}…</p>
          )}
          {place.done_at && <p className="text-xs text-muted">Testé {fromNow(place.done_at)}</p>}
          <button type="button" onClick={markTodo} className="text-sm font-semibold text-muted underline-offset-2 active:underline">
            ↩️ Remettre dans « À tester »
          </button>
        </Card>
      )}

      {/* Carte et liens */}
      {hasCoords && (
        <a
          href={appleMapsUrl(place)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block h-44 overflow-hidden rounded-3xl border border-line"
          aria-label="Ouvrir dans Plans"
        >
          <div className="pointer-events-none size-full">
            <PlacesMap
              places={[{ id: place.id, name: place.name, category: place.category, lat: place.lat!, lng: place.lng!, status: place.status }]}
              single
              interactive={false}
            />
          </div>
        </a>
      )}

      <div className="mt-3 space-y-2">
        <ExternalRow href={appleMapsUrl(place)} emoji="🧭" label="Ouvrir dans Plans" />
        {place.instagram && <ExternalRow href={instagramUrl(place.instagram)} emoji="📸" label={`@${place.instagram}`} />}
        {place.url && <ExternalRow href={place.url} emoji="🔗" label={hostLabel(place.url)} />}
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted">
        {place.added_by && <Avatar person={personOf(place.added_by)} size={20} />}
        Ajouté par {place.added_by === me.id ? "toi" : nameOf(place.added_by)} {fromNow(place.created_at)}
      </p>

      {/* Feuille : notation */}
      <Sheet open={rateOpen} onClose={() => setRateOpen(false)} title={place.status === "todo" ? "Alors, c'était comment ? 😋" : "Ta note"}>
        <div className="space-y-5">
          {isParent && (
          <div>
            <p className="mb-2 font-medium">Ta note</p>
            <StarPicker
              value={myRating}
              onChange={async (n) => {
                await rate(n);
                setRateOpen(false);
                toast(n >= 4 ? "Top ! 😍" : n <= 2 ? "Bon, on ne reviendra pas 😬" : "Noté ✅", "success");
              }}
            />
          </div>
          )}
          {partner && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Avatar person={personOf(partner.id)} size={26} />
              {partner.display_name} :{" "}
              {partnerRating !== null ? <Stars value={partnerRating} /> : "pas encore noté"}
            </div>
          )}
          {!isParent && (
            <>
              <p className="text-sm text-muted">Seuls les parents notent les sorties.</p>
              {place.status === "todo" && (
                <Button
                  className="w-full"
                  onClick={async () => {
                    await update({ status: "done", done_at: new Date().toISOString() });
                    setRateOpen(false);
                  }}
                >
                  ✅ Marquer comme testé
                </Button>
              )}
            </>
          )}
        </div>
      </Sheet>

      {/* Feuille : modification */}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Modifier">
        {editing && (
          <PlaceForm values={editing} onChange={setEditing} onSubmit={saveEdit} saving={saving} submitLabel="Enregistrer" canChooseSpace={isParent} />
        )}
      </Sheet>
    </>
  );
}

function hostLabel(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function ExternalRow({ href, emoji, label }: { href: string; emoji: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 font-medium active:bg-card-2"
    >
      <span className="text-xl">{emoji}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ExternalLink className="size-4 text-muted" />
    </a>
  );
}
