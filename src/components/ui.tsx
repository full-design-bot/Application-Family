"use client";

// Kit d'interface commun de Noesia Family.
// Utiliser ces composants partout pour garder une app cohérente.

import Link from "next/link";
import { ChevronLeft, Loader2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Person } from "@/lib/types";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------- Boutons
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink shadow-sm active:brightness-95",
  secondary: "bg-card text-ink border border-line active:bg-card-2",
  ghost: "bg-transparent text-ink active:bg-card-2",
  danger: "bg-danger text-white active:brightness-95",
  soft: "bg-accent-soft text-accent active:brightness-95",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const sizes = { sm: "h-9 px-3 text-sm rounded-xl", md: "h-11 px-4 rounded-2xl", lg: "h-14 px-6 text-lg rounded-2xl" };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition disabled:opacity-50 select-none",
        buttonStyles[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 font-semibold transition select-none",
        buttonStyles[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function IconButton({
  className,
  children,
  label,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn("inline-flex size-10 items-center justify-center rounded-full text-ink active:bg-card-2 transition", className)}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Cartes
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-3xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-line", className)} {...props}>
      {children}
    </div>
  );
}

export function CardLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn("block rounded-3xl bg-card p-4 border border-line active:scale-[0.99] transition", className)}
    >
      {children}
    </Link>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- En-tête de page
export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** lien de retour (ex. "/jeux") */
  back?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start gap-2 pt-2">
      {back && (
        <Link href={back} aria-label="Retour" className="-ml-2 mt-0.5 inline-flex size-10 items-center justify-center rounded-full active:bg-card-2">
          <ChevronLeft className="size-6" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-[28px] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

// ---------------------------------------------------------------- Formulaires
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block px-1 text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block px-1 text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-2xl border border-line bg-card px-4 py-3 text-ink placeholder:text-muted/70 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, "min-h-24 resize-none", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, "h-12 appearance-none", className)} {...props}>
      {children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl px-1 py-2 text-left"
      role="switch"
      aria-checked={checked}
    >
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-sage" : "bg-line")}>
        <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

/** Choix exclusif sous forme de pastilles */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 rounded-2xl bg-card-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
            value === o.value ? "bg-card text-ink shadow-sm" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  color,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
        active ? "border-transparent bg-ink text-bg" : "border-line bg-card text-ink",
        className,
      )}
      style={active && color ? { background: color, color: "#fff" } : undefined}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Feuille modale (bas de l'écran)
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-bg px-4 pb-safe pt-3 shadow-2xl">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <IconButton label="Fermer" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="pb-6">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Divers
export function EmptyState({
  emoji,
  title,
  text,
  action,
}: {
  emoji: string;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 text-5xl">{emoji}</div>
      <p className="text-lg font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-6 animate-spin text-muted", className)} />;
}

export function LoadingBlock() {
  return (
    <div className="flex justify-center py-12">
      <Spinner />
    </div>
  );
}

/** Pastille ronde d'une personne (emoji sur sa couleur) */
export function Avatar({ person, size = 36, className }: { person?: Pick<Person, "emoji" | "color" | "name"> | null; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full", className)}
      style={{ width: size, height: size, background: person?.color ?? "var(--line)", fontSize: size * 0.5 }}
      title={person?.name}
    >
      {person?.emoji ?? "🙂"}
    </span>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-ink", className)}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- Toasts
interface Toast {
  id: number;
  text: string;
  tone: "info" | "error" | "success";
}
const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-safe">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-pop mt-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg",
              t.tone === "error" ? "bg-danger text-white" : t.tone === "success" ? "bg-sage text-white" : "bg-ink text-bg",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** const toast = useToast(); toast("Enregistré ✅", "success") */
export function useToast() {
  return useContext(ToastContext);
}
