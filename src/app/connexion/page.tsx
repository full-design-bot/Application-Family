"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Input } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

// Connexion par code reçu par e-mail (et non par lien) :
// sur iPhone, un lien s'ouvrirait dans Safari et non dans l'app installée.
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("erreur") === "compte" ? "Ce compte n'est pas autorisé dans Noesia Family." : null,
  );

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      setError(
        /database error|non autoris/i.test(error.message)
          ? "Cette adresse n'est pas autorisée. Demande à l'autre parent de l'ajouter."
          : /rate|seconds/i.test(error.message)
            ? "Patiente quelques secondes avant de redemander un code."
            : error.message,
      );
      return;
    }
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.replace(/\s/g, ""),
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError("Code incorrect ou expiré.");
      return;
    }
    router.replace(params.get("suite") || "/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pt-safe pb-safe">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-[28px] bg-accent text-4xl shadow-lg">🏡</div>
        <h1 className="text-3xl font-bold">Noesia Family</h1>
        <p className="mt-1 text-muted">Notre petit monde à nous</p>
      </div>

      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="ton@email.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Recevoir mon code
          </Button>
          <p className="text-center text-sm text-muted">Tu vas recevoir un code à 6 chiffres par e-mail.</p>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-center text-muted">
            Code envoyé à <strong className="text-ink">{email}</strong>
          </p>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="text-center text-2xl tracking-[0.4em]"
            maxLength={10}
            required
            autoFocus
          />
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Se connecter
          </Button>
          <button type="button" className="w-full py-2 text-sm text-muted" onClick={() => setStep("email")}>
            Changer d&apos;adresse ou renvoyer un code
          </button>
        </form>
      )}

      {error && <p className="mt-4 rounded-2xl bg-accent-soft p-3 text-center text-sm text-danger">{error}</p>}
    </div>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
