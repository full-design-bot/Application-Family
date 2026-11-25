"use client";

import { SpicyLock } from "@/components/SpicyLock";
import { PageHeader, cn } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { effectiveLevel, LEVELS, toLevel, type SpicyLevel } from "@/lib/jeux/niveau";
import { notify } from "@/lib/push/client";

/** Page coquine : verrou Face ID / code + en-tête. */
export function CoquinsPage({
  title,
  subtitle,
  back = "/jeux/coquins",
  children,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  children: React.ReactNode;
}) {
  return (
    <SpicyLock>
      <PageHeader title={title} subtitle={subtitle} back={back} />
      {children}
    </SpicyLock>
  );
}

/** Niveau effectif du couple = le plus prudent des deux réglages. */
export function useSpicyLevel(): { level: SpicyLevel; mine: SpicyLevel; partnerLevel: SpicyLevel | null } {
  const { me, partner } = useFamily();
  const mine = toLevel(me.settings?.spicy_max_level ?? 1);
  const partnerLevel = partner ? toLevel(partner.settings?.spicy_max_level ?? 1) : null;
  return { level: effectiveLevel(mine, partnerLevel), mine, partnerLevel };
}

export function LevelPill({ level, className }: { level: SpicyLevel; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-rose-soft px-2.5 py-0.5 text-xs font-semibold text-rose", className)}>
      {LEVELS[level].emoji} {LEVELS[level].label}
    </span>
  );
}

/** Notification coquine : toujours discrète sur l'écran verrouillé. */
export function notifyCoquin(path: string, title = "🔥 Coquins") {
  void notify({ title, discreet: true, url: `/jeux/coquins/${path}` });
}
