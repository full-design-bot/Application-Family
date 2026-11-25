"use client";

import { useParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { ActivitiesTab, InfosTab } from "@/components/agenda/ChildInfoTabs";
import { GrowthTab, HealthTab, MemoriesTab, QuotesTab } from "@/components/agenda/ChildJournal";
import { ChildProfileSheet } from "@/components/agenda/ChildProfileSheet";
import { ageLabel } from "@/components/agenda/shared";
import { Avatar, EmptyState, IconButton, LinkButton, PageHeader, Segmented } from "@/components/ui";
import { formatDateFull } from "@/lib/dates";
import { useFamily } from "@/lib/family";

type Tab = "activites" | "infos" | "mots" | "sante" | "croissance" | "souvenirs";

const TABS: { value: Tab; label: string }[] = [
  { value: "activites", label: "🗓️ Activités" },
  { value: "infos", label: "📋 Infos" },
  { value: "mots", label: "💬 Mots" },
  { value: "sante", label: "🩺 Santé" },
  { value: "croissance", label: "📏 Croissance" },
  { value: "souvenirs", label: "🖼️ Souvenirs" },
];

export default function ChildPage() {
  const { id } = useParams<{ id: string }>();
  const { personById, isParent } = useFamily();
  const child = personById(id);
  const [tab, setTab] = useState<Tab>("activites");
  const [editing, setEditing] = useState(false);

  if (!child || child.kind !== "child") {
    return (
      <>
        <PageHeader title="Les enfants" back="/enfants" />
        <EmptyState emoji="🫥" title="Profil introuvable" action={<LinkButton href="/enfants">Retour</LinkButton>} />
      </>
    );
  }

  const age = ageLabel(child.birthdate);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar person={child} size={48} /> {child.name}
          </span>
        }
        subtitle={age && child.birthdate ? `${age} · 🎂 ${formatDateFull(child.birthdate)}` : undefined}
        back="/enfants"
        action={
          isParent && (
            <IconButton label="Modifier le profil" onClick={() => setEditing(true)} className="border border-line bg-card">
              <Pencil className="size-4" />
            </IconButton>
          )
        }
      />

      <div className="no-scrollbar -mx-4 mb-4 overflow-x-auto px-4">
        <Segmented value={tab} onChange={setTab} options={TABS} className="min-w-max [&>button]:whitespace-nowrap" />
      </div>

      {tab === "activites" && <ActivitiesTab child={child} />}
      {tab === "infos" && <InfosTab key={child.id} child={child} />}
      {tab === "mots" && <QuotesTab child={child} />}
      {tab === "sante" && <HealthTab child={child} />}
      {tab === "croissance" && <GrowthTab child={child} />}
      {tab === "souvenirs" && <MemoriesTab child={child} />}

      <ChildProfileSheet open={editing} onClose={() => setEditing(false)} child={child} />
    </>
  );
}
