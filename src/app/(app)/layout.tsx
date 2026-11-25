import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/ui";
import { FamilyProvider } from "@/lib/family";
import { currentMember } from "@/lib/supabase/server";
import type { Member, Person } from "@/lib/types";

// Toutes les pages de l'app nécessitent d'être connecté.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await currentMember();
  if (!ctx) redirect("/connexion?erreur=compte");

  const [{ data: members }, { data: people }] = await Promise.all([
    ctx.sb.from("members").select("*").order("created_at"),
    ctx.sb.from("people").select("*").order("kind", { ascending: false }).order("sort_order").order("created_at"),
  ]);

  return (
    <FamilyProvider
      initialMe={ctx.member as Member}
      initialMembers={(members ?? []) as Member[]}
      initialPeople={(people ?? []) as Person[]}
    >
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </FamilyProvider>
  );
}
