import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Plus" };

const ITEMS = [
  { href: "/nous-deux", emoji: "💑", title: "Nous deux", text: "Question du jour, humeur, capsules, liste à vivre", color: "bg-rose-soft" },
  { href: "/enfants", emoji: "👦👧", title: "Les enfants", text: "Profils, santé, mots d'enfants, souvenirs", color: "bg-sky-soft" },
  { href: "/sorties", emoji: "📍", title: "Sorties", text: "Restos et idées de sorties", color: "bg-sand-soft" },
  { href: "/rappels", emoji: "⏰", title: "Rappels", text: "Avec accusé « C'est fait »", color: "bg-accent-soft" },
  { href: "/listes", emoji: "📝", title: "Listes", text: "Courses, cadeaux, rentrée…", color: "bg-sage-soft" },
  { href: "/dessin", emoji: "🎨", title: "Dessin", text: "Dessiner à deux en direct", color: "bg-sand-soft" },
  { href: "/souvenirs", emoji: "📸", title: "Souvenirs", text: "Photos gardées et moments précieux", color: "bg-rose-soft" },
  { href: "/reglages", emoji: "⚙️", title: "Réglages", text: "Notifications, profil, verrou Face ID", color: "bg-card-2" },
];

export default function PlusPage() {
  return (
    <>
      <PageHeader title="Plus" />
      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className={`rounded-3xl p-4 ${i.color} active:scale-[0.98] transition`}>
            <div className="text-3xl">{i.emoji}</div>
            <p className="mt-2 font-bold">{i.title}</p>
            <p className="text-sm leading-snug text-muted">{i.text}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
