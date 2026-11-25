"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Dices, Home, LayoutGrid, MessageCircleHeart } from "lucide-react";
import { useEffect, useState } from "react";
import { useFamily } from "@/lib/family";
import { registerServiceWorker, setBadge } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";
import { cn } from "./ui";

const TABS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: MessageCircleHeart },
  { href: "/jeux", label: "Jeux", icon: Dices },
  { href: "/plus", label: "Plus", icon: LayoutGrid },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me } = useFamily();
  const unread = useUnreadMessages(me.id, pathname.startsWith("/messages"));

  useEffect(() => {
    registerServiceWorker().catch(() => {});
  }, []);

  // Les pages plein écran (dessin, partie en cours…) peuvent masquer la barre
  const hideNav = pathname.startsWith("/dessin/") || pathname.startsWith("/jeux/coquins/verrou");

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main className={cn("flex-1 px-4 pt-safe", hideNav ? "pb-6" : "pb-28")}>{children}</main>
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-xl pb-safe">
          <div className="mx-auto flex max-w-lg">
            {TABS.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium transition",
                    active ? "text-accent" : "text-muted",
                  )}
                >
                  <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                  {label}
                  {href === "/messages" && unread > 0 && (
                    <span className="absolute right-[calc(50%-22px)] top-1 min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] font-bold leading-5 text-accent-ink">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

/** Nombre de messages non lus (temps réel) + pastille de l'icône de l'app */
function useUnreadMessages(meId: string, onMessagesPage: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (onMessagesPage) {
      setCount(0);
      return;
    }
    const sb = supabase();
    let alive = true;
    (async () => {
      const { data: read } = await sb.from("chat_reads").select("last_read_at").eq("member_id", meId).eq("channel", "couple").maybeSingle();
      const since = read?.last_read_at ?? "1970-01-01";
      const { count: c } = await sb
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("channel", "couple")
        .neq("sender_id", meId)
        .gt("created_at", since);
      if (alive) setCount(c ?? 0);
    })();
    const channel = sb
      .channel(`unread-${meId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        if ((payload.new as { sender_id: string }).sender_id !== meId) setCount((c) => c + 1);
      })
      .subscribe();
    return () => {
      alive = false;
      sb.removeChannel(channel);
    };
  }, [meId, onMessagesPage]);

  useEffect(() => {
    setBadge(count);
  }, [count]);

  return count;
}
