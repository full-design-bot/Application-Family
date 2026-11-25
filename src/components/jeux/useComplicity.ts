"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/lib/family";
import { COMPLICITY_GAMES, computeComplicity, type PairedRowLite } from "@/lib/jeux/complicite";
import { supabase } from "@/lib/supabase/client";

/** Score de complicité du couple (jeux « Pour mieux se connaître »). */
export function useComplicity() {
  const { me, partner, isParent } = useFamily();
  const [rows, setRows] = useState<PairedRowLite[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!isParent) {
      setLoading(false);
      return;
    }
    const { data } = await supabase()
      .from("paired_answers")
      .select("game, item_key, member_id, answer, guess, created_at")
      .in("game", [...COMPLICITY_GAMES]);
    setRows((data ?? []) as PairedRowLite[]);
    setLoading(false);
  }, [isParent]);

  useEffect(() => {
    reload();
  }, [reload]);

  const result = useMemo(() => computeComplicity(rows, me.id, partner?.id), [rows, me.id, partner?.id]);
  return { ...result, loading, reload };
}
