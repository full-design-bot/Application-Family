"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellOff, LogOut, ScanFace, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, Button, Card, Field, Input, PageHeader, SectionTitle, Segmented, Toggle, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { biometricAvailable, forgetBiometric, hasBiometricCredential, hashPin, registerBiometric } from "@/lib/lock";
import { currentSubscription, disablePush, enablePush, isIOS, isStandalone, notify, pushSupported } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";

const COLORS = ["#e07a5f", "#3d5a80", "#81b29a", "#d66b8f", "#f2a65a", "#7b6cd9", "#4aa3a2", "#8a7d73"];
const EMOJIS = ["🦊", "🐻", "🦁", "🐼", "🐯", "🐨", "🦉", "🐬", "🌻", "🌙", "⭐", "🍀", "🔥", "💎", "🎸", "☕"];

export default function ReglagesPage() {
  const { me, personOf, reload } = useFamily();
  const toast = useToast();
  const router = useRouter();
  const person = personOf(me.id);

  const [name, setName] = useState(me.display_name);
  const [color, setColor] = useState(person?.color ?? COLORS[0]);
  const [emoji, setEmoji] = useState(person?.emoji ?? "🙂");
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [hasBio, setHasBio] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    currentSubscription().then((s) => setPushOn(!!s));
    biometricAvailable().then(setBioAvailable);
    setHasBio(hasBiometricCredential());
  }, []);

  async function saveProfile() {
    const sb = supabase();
    await sb.from("members").update({ display_name: name.trim() || me.display_name }).eq("id", me.id);
    if (person) await sb.from("people").update({ name: name.trim() || person.name, color, emoji }).eq("id", person.id);
    await reload();
    toast("Profil enregistré ✅", "success");
  }

  async function updateSettings(patch: Record<string, unknown>) {
    await supabase().from("members").update({ settings: { ...me.settings, ...patch } }).eq("id", me.id);
    await reload();
  }

  async function togglePush() {
    setPushBusy(true);
    if (pushOn) {
      await disablePush();
      setPushOn(false);
      toast("Notifications désactivées sur cet appareil");
    } else {
      const res = await enablePush();
      if (res.ok) {
        setPushOn(true);
        toast("Notifications activées 🔔", "success");
      } else toast(res.error ?? "Erreur", "error");
    }
    setPushBusy(false);
  }

  async function setupBio() {
    if (await registerBiometric(me.id, me.email)) {
      setHasBio(true);
      await updateSettings({ spicy_lock: true });
      toast("Face ID configuré 🔒", "success");
    } else toast("Configuration annulée", "error");
  }

  async function savePin() {
    if (!/^\d{4,8}$/.test(pin)) return toast("Le code doit faire 4 à 8 chiffres", "error");
    await updateSettings({ spicy_pin_hash: await hashPin(pin, me.id), spicy_lock: true });
    setPin("");
    toast("Code enregistré 🔒", "success");
  }

  async function logout() {
    await supabase().auth.signOut();
    router.replace("/connexion");
    router.refresh();
  }

  const standaloneWarning = typeof window !== "undefined" && isIOS() && !isStandalone();

  return (
    <>
      <PageHeader title="Réglages" back="/plus" />

      <SectionTitle>Mon profil</SectionTitle>
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar person={{ emoji, color, name }} size={56} />
          <Field label="Mon prénom">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <div>
          <p className="mb-2 px-1 text-sm font-medium text-muted">Ma couleur</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`size-9 rounded-full ${color === c ? "ring-4 ring-ink/20" : ""}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 px-1 text-sm font-medium text-muted">Mon emoji</p>
          <div className="flex flex-wrap gap-1">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setEmoji(e)} className={`size-10 rounded-xl text-2xl ${emoji === e ? "bg-accent-soft" : ""}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={saveProfile} className="w-full">
          Enregistrer
        </Button>
      </Card>

      <SectionTitle>Notifications</SectionTitle>
      <Card className="space-y-3">
        {standaloneWarning && (
          <div className="rounded-2xl bg-sand-soft p-3 text-sm">
            <Smartphone className="mb-1 size-5" />
            Sur iPhone, les notifications ne marchent que si l&apos;app est ajoutée à l&apos;écran d&apos;accueil.{" "}
            <Link href="/installer" className="font-semibold underline">
              Voir comment faire
            </Link>
          </div>
        )}
        <p className="text-sm text-muted">
          {pushOn === null
            ? "…"
            : pushOn
              ? "Les notifications sont activées sur cet appareil."
              : pushSupported()
                ? "Les notifications ne sont pas encore activées sur cet appareil."
                : "Notifications indisponibles ici."}
        </p>
        <Button onClick={togglePush} loading={pushBusy} variant={pushOn ? "secondary" : "primary"} className="w-full">
          {pushOn ? <BellOff className="size-5" /> : <Bell className="size-5" />}
          {pushOn ? "Désactiver sur cet appareil" : "Activer les notifications"}
        </Button>
        {pushOn && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={async () => {
              await notify({ to: "me", title: "🔔 Test Noesia", body: "Les notifications fonctionnent !", url: "/reglages" });
              toast("Notification de test envoyée");
            }}
          >
            Envoyer une notification de test
          </Button>
        )}
      </Card>

      <SectionTitle>Espace coquin 🔥</SectionTitle>
      <Card className="space-y-4">
        <div>
          <p className="mb-2 px-1 text-sm font-medium text-muted">Mon niveau maximum</p>
          <Segmented
            value={String(me.settings?.spicy_max_level ?? 1)}
            onChange={(v) => updateSettings({ spicy_max_level: Number(v) })}
            options={[
              { value: "1", label: "😊 Tendre" },
              { value: "2", label: "😏 Audacieux" },
              { value: "3", label: "🔥 Très" },
            ]}
          />
          <p className="mt-1 px-1 text-xs text-muted">L&apos;app ne propose jamais plus fort que le niveau le plus bas de vous deux.</p>
        </div>
        <Toggle
          checked={me.settings?.spicy_lock !== false}
          onChange={(v) => updateSettings({ spicy_lock: v })}
          label="Verrouiller l'espace coquin"
          description="Face ID ou code à l'ouverture"
        />
        {bioAvailable &&
          (hasBio ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                forgetBiometric();
                setHasBio(false);
              }}
            >
              <ScanFace className="size-5" /> Retirer Face ID
            </Button>
          ) : (
            <Button variant="secondary" className="w-full" onClick={setupBio}>
              <ScanFace className="size-5" /> Configurer Face ID
            </Button>
          ))}
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            type="password"
            placeholder={me.settings?.spicy_pin_hash ? "Nouveau code" : "Code de secours (4 chiffres)"}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength={8}
          />
          <Button variant="secondary" onClick={savePin}>
            OK
          </Button>
        </div>
      </Card>

      <SectionTitle>App</SectionTitle>
      <Card className="space-y-2">
        <Link href="/installer" className="block py-2 font-medium">
          📲 Installer sur iPhone
        </Link>
        <Link href="/enfants" className="block py-2 font-medium">
          👦👧 Gérer les profils des enfants
        </Link>
        <Button variant="ghost" className="w-full justify-start px-0 text-danger" onClick={logout}>
          <LogOut className="size-5" /> Se déconnecter
        </Button>
      </Card>
      <p className="mt-6 text-center text-xs text-muted">Noesia Family · connecté en tant que {me.email}</p>
    </>
  );
}
