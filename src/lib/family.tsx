"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Holiday } from "./holidays";
import { FALLBACK_HOLIDAYS_ZONE_A } from "./holidays";
import { supabase } from "./supabase/client";
import type { Member, Person } from "./types";

interface FamilyContextValue {
  /** Membre connecté */
  me: Member;
  /** Tous les comptes (parents) */
  members: Member[];
  /** L'autre parent (null s'il ne s'est pas encore connecté une première fois) */
  partner: Member | null;
  /** Toutes les personnes (parents + enfants) */
  people: Person[];
  children: Person[];
  /** Personne liée à un membre */
  personOf: (memberId: string | null | undefined) => Person | undefined;
  personById: (id: string | null | undefined) => Person | undefined;
  memberById: (id: string | null | undefined) => Member | undefined;
  /** Nom à afficher pour un membre ("toi" possible) */
  nameOf: (memberId: string | null | undefined) => string;
  isParent: boolean;
  reload: () => Promise<void>;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({
  initialMe,
  initialMembers,
  initialPeople,
  children,
}: {
  initialMe: Member;
  initialMembers: Member[];
  initialPeople: Person[];
  children: React.ReactNode;
}) {
  const [me, setMe] = useState(initialMe);
  const [members, setMembers] = useState(initialMembers);
  const [people, setPeople] = useState(initialPeople);

  const reload = useCallback(async () => {
    const sb = supabase();
    const [{ data: m }, { data: p }] = await Promise.all([
      sb.from("members").select("*").order("created_at"),
      sb.from("people").select("*").order("kind", { ascending: false }).order("sort_order").order("created_at"),
    ]);
    if (m) {
      setMembers(m as Member[]);
      const mine = (m as Member[]).find((x) => x.id === me.id);
      if (mine) setMe(mine);
    }
    if (p) setPeople(p as Person[]);
  }, [me.id]);

  const value = useMemo<FamilyContextValue>(() => {
    const personById = (id: string | null | undefined) => people.find((p) => p.id === id);
    const memberById = (id: string | null | undefined) => members.find((m) => m.id === id);
    const personOf = (memberId: string | null | undefined) => {
      const m = memberById(memberId);
      return m?.person_id ? personById(m.person_id) : undefined;
    };
    return {
      me,
      members,
      partner: members.find((m) => m.id !== me.id && m.role === "parent") ?? null,
      people,
      children: people.filter((p) => p.kind === "child"),
      personOf,
      personById,
      memberById,
      nameOf: (memberId) => memberById(memberId)?.display_name ?? "Quelqu'un",
      isParent: me.role === "parent",
      reload,
    };
  }, [me, members, people, reload]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily(): FamilyContextValue {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily doit être utilisé dans <FamilyProvider>");
  return ctx;
}

// ---------------------------------------------------------------------
// Vacances scolaires (chargées une fois puis gardées en mémoire)
// ---------------------------------------------------------------------
let holidaysCache: Holiday[] | null = null;
let holidaysPromise: Promise<Holiday[]> | null = null;

export function loadHolidays(): Promise<Holiday[]> {
  if (holidaysCache) return Promise.resolve(holidaysCache);
  if (!holidaysPromise) {
    holidaysPromise = fetch("/api/holidays")
      .then((r) => r.json())
      .then((j) => (holidaysCache = (j.holidays as Holiday[]) ?? FALLBACK_HOLIDAYS_ZONE_A))
      .catch(() => (holidaysCache = FALLBACK_HOLIDAYS_ZONE_A));
  }
  return holidaysPromise;
}

export function useHolidays(): Holiday[] {
  const [list, setList] = useState<Holiday[]>(holidaysCache ?? FALLBACK_HOLIDAYS_ZONE_A);
  useEffect(() => {
    let alive = true;
    loadHolidays().then((h) => alive && setList(h));
    return () => {
      alive = false;
    };
  }, []);
  return list;
}
