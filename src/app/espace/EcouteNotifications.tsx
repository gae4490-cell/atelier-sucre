"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Toast } from "@/components/ui";

/**
 * Met le tableau de bord à jour dès qu'une alerte arrive (Supabase Realtime, filtré par RLS).
 * Repli : actualisation toutes les 60 s lorsque l'onglet est visible, et au retour sur l'onglet.
 */
export function EcouteNotifications({ atelierId }: { atelierId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const fin = useCallback(() => setMessage(null), []);
  const derniere = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`notifications:${atelierId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `atelier_id=eq.${atelierId}` },
        (payload) => {
          const titre = (payload.new as { titre?: string }).titre;
          setMessage(titre ?? "Nouvelle notification");
          router.refresh();
        },
      )
      .subscribe();

    const rafraichir = () => {
      if (document.visibilityState !== "visible") return;
      const maintenant = Date.now();
      if (maintenant - derniere.current < 15_000) return;
      derniere.current = maintenant;
      router.refresh();
    };
    const minuterie = setInterval(rafraichir, 60_000);
    document.addEventListener("visibilitychange", rafraichir);

    return () => {
      clearInterval(minuterie);
      document.removeEventListener("visibilitychange", rafraichir);
      supabase.removeChannel(canal);
    };
  }, [atelierId, router]);

  return <Toast message={message} onFin={fin} />;
}
