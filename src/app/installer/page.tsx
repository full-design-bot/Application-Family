import Link from "next/link";

export const metadata = { title: "Installer sur iPhone" };

const STEPS = [
  { emoji: "🧭", title: "Ouvre l'app dans Safari", text: "Pas Chrome ni l'app Gmail : Safari uniquement." },
  { emoji: "⬆️", title: "Touche « Partager »", text: "Le carré avec une flèche vers le haut, en bas de l'écran." },
  { emoji: "➕", title: "« Sur l'écran d'accueil »", text: "Fais défiler la liste si besoin, puis touche « Ajouter »." },
  { emoji: "🏡", title: "Ouvre Noesia depuis l'icône", text: "Connecte-toi avec ton code reçu par e-mail." },
  { emoji: "🔔", title: "Active les notifications", text: "Dans Plus → Réglages, touche « Activer les notifications » puis « Autoriser »." },
];

export default function InstallerPage() {
  return (
    <div className="mx-auto max-w-md px-5 py-8 pt-safe">
      <h1 className="text-3xl font-bold">Installer Noesia sur iPhone</h1>
      <p className="mt-1 text-muted">5 étapes, une seule fois. Il faut iOS 16.4 ou plus récent.</p>
      <ol className="mt-6 space-y-3">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-4 rounded-3xl border border-line bg-card p-4">
            <div className="text-3xl">{s.emoji}</div>
            <div>
              <p className="font-semibold">
                {i + 1}. {s.title}
              </p>
              <p className="text-sm text-muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link href="/" className="mt-8 block text-center font-semibold text-accent">
        Retour à l&apos;app →
      </Link>
    </div>
  );
}
