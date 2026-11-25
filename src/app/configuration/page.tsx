import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Page affichée tant que l'app n'est pas paramétrée (variables d'environnement manquantes).
export default function ConfigurationPage() {
  const checks = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    {
      name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
    { name: "SUPABASE_SECRET_KEY", ok: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) },
    { name: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", ok: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) },
    { name: "VAPID_PRIVATE_KEY", ok: Boolean(process.env.VAPID_PRIVATE_KEY) },
    { name: "CRON_SECRET", ok: Boolean(process.env.CRON_SECRET) },
  ];
  return (
    <div className="mx-auto max-w-md px-6 py-12 pt-safe">
      <div className="mb-6 text-5xl">🛠️</div>
      <h1 className="text-3xl font-bold">Noesia Family n&apos;est pas encore paramétrée</h1>
      <p className="mt-2 text-muted">
        Il manque des variables d&apos;environnement. Suis le guide <strong>docs/PARAMETRAGE.md</strong> du projet.
      </p>
      <ul className="mt-6 space-y-2">
        {checks.map((c) => (
          <li key={c.name} className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-sm">
            <code>{c.name}</code>
            <span>{c.ok ? "✅" : "❌"}</span>
          </li>
        ))}
      </ul>
      {isSupabaseConfigured() && (
        <Link href="/connexion" className="mt-6 block text-center font-semibold text-accent">
          Aller à la connexion →
        </Link>
      )}
    </div>
  );
}
