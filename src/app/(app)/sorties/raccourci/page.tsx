"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, LinkButton, PageHeader, useToast } from "@/components/ui";

interface Step {
  title: string;
  text: React.ReactNode;
  /** Description de ce qu'on voit à l'écran (capture décrite) */
  screen: string;
}

export default function RaccourciPage() {
  const toast = useToast();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"url" | "origin" | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const shortcutUrl = `${origin || "https://…"}/sorties/ajouter?url=`;

  async function copy(text: string, which: "url" | "origin") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      toast("Copié 📋", "success");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast("Copie impossible : sélectionne le texte à la main.", "error");
    }
  }

  const steps: Step[] = [
    {
      title: "Ouvre l'app Raccourcis",
      text: (
        <>
          Elle est installée d&apos;office sur l&apos;iPhone (icône violette et rose). Si tu ne la trouves pas, cherche « Raccourcis » en
          glissant vers le bas sur l&apos;écran d&apos;accueil.
        </>
      ),
      screen: "L'onglet « Raccourcis » en bas, avec la liste de tes raccourcis et un bouton « + » en haut à droite.",
    },
    {
      title: "Crée un nouveau raccourci",
      text: (
        <>
          Touche <b>+</b> en haut à droite. Touche le nom en haut (« Nouveau raccourci ») → <b>Renommer</b> → tape{" "}
          <b>Ajouter à Noesia</b>. Tu peux aussi choisir une icône 📍 et une couleur.
        </>
      ),
      screen: "Un écran vide « Nouveau raccourci » avec un champ « Rechercher des actions » en bas.",
    },
    {
      title: "Affiche-le dans la feuille de partage",
      text: (
        <>
          Touche le petit <b>ⓘ</b> (ou la flèche ⌄ à côté du nom) → active <b>Afficher dans la feuille de partage</b>. En haut du raccourci
          apparaît « Recevoir <i>Tout</i> depuis Feuille de partage » : touche <b>Tout</b>, désélectionne tout, puis coche seulement{" "}
          <b>URL</b> et <b>Texte</b>.
        </>
      ),
      screen: "Un bloc bleu « Recevoir URL et Texte depuis Feuille de partage. Si aucune entrée : Continuer ».",
    },
    {
      title: "Ajoute l'action « Encoder en URL »",
      text: (
        <>
          Dans « Rechercher des actions », tape <b>Encoder</b> et choisis <b>Encoder en URL</b>. Vérifie qu&apos;elle encode bien{" "}
          <b>Entrée du raccourci</b> (sinon touche le champ bleu et choisis-la).
        </>
      ),
      screen: "Un bloc « Encoder en URL Entrée du raccourci » sous le bloc de partage.",
    },
    {
      title: "Ajoute l'action « Ouvrir les URL »",
      text: (
        <>
          Cherche <b>Ouvrir les URL</b> et ajoute-la. Touche le champ « URL » et colle l&apos;adresse ci-dessous, puis, juste à la fin, insère la
          variable <b>Texte encodé en URL</b> (elle apparaît au-dessus du clavier).
        </>
      ),
      screen: "Un bloc « Ouvrir https://…/sorties/ajouter?url=[Texte encodé en URL] ».",
    },
    {
      title: "C'est prêt !",
      text: (
        <>
          Touche <b>OK</b>. Depuis Safari, Instagram, Google Maps ou Plans : bouton <b>Partager</b> → fais défiler les actions →{" "}
          <b>Ajouter à Noesia</b>. L&apos;app s&apos;ouvre et analyse le lien toute seule ✨
        </>
      ),
      screen: "Dans la feuille de partage, une ligne « Ajouter à Noesia » avec ton icône 📍.",
    },
  ];

  return (
    <>
      <PageHeader title="Raccourci iPhone 📲" subtitle="Ajouter une idée depuis le bouton Partager" back="/sorties" />

      <Card className="space-y-3 bg-accent-soft">
        <p className="font-semibold">L&apos;adresse à mettre dans le raccourci :</p>
        <code className="block break-all rounded-2xl bg-card px-3 py-2 text-sm">
          {shortcutUrl}
          <span className="rounded bg-sky-soft px-1 text-sky">[Texte encodé en URL]</span>
        </code>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => copy(shortcutUrl, "url")} disabled={!origin} size="sm">
            {copied === "url" ? <Check className="size-4" /> : <Copy className="size-4" />} Copier l&apos;adresse
          </Button>
          <Button onClick={() => copy(origin, "origin")} disabled={!origin} size="sm" variant="secondary">
            {copied === "origin" ? <Check className="size-4" /> : <Copy className="size-4" />} Copier le site
          </Button>
        </div>
        <p className="text-xs text-muted">Adresse de ton app : {origin || "…"}</p>
      </Card>

      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Card>
              <div className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-ink">{i + 1}</span>
                <div className="min-w-0 space-y-2">
                  <p className="font-bold">{s.title}</p>
                  <p className="text-sm leading-relaxed">{s.text}</p>
                  <p className="rounded-2xl border border-dashed border-line bg-card-2 px-3 py-2 text-xs text-muted">🖼️ À l&apos;écran : {s.screen}</p>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <Card className="mt-5 space-y-2 text-sm">
        <p className="font-semibold">💡 Bon à savoir</p>
        <p>
          La première fois, iPhone demande « Autoriser Ajouter à Noesia à ouvrir … ? » : réponds <b>Toujours autoriser</b>.
        </p>
        <p>Si tu n&apos;es pas connecté(e), l&apos;app te demandera ton code puis reviendra sur l&apos;ajout.</p>
        <p>
          Sans raccourci, ça marche aussi : copie le lien (Partager → Copier) puis colle-le dans <b>➕ Ajouter</b>.
        </p>
      </Card>

      <div className="mt-5">
        <LinkButton href={`/sorties/ajouter?url=${encodeURIComponent("https://www.google.com/maps/place/Le+Petit+Commerce/@44.8402405,-0.5712429,17z")}`} variant="soft" className="w-full">
          🧪 Tester avec un lien d&apos;exemple
        </LinkButton>
      </div>
    </>
  );
}
