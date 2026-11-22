import "server-only";
import { cache } from "react";
import { exigerAtelier } from "@/lib/atelier";
import { createAdminClient } from "@/lib/supabase/admin";
import { OFFRES, type IdOffre } from "@/lib/offres";

export type InfosAbonnement = {
  offreActive: IdOffre;
  offreChoisie: IdOffre;
  statut: string;
  finAcces: string | null;
  clientStripe: string | null;
  estPro: boolean;
};

/** Offre active de l'atelier connecté, calculée par la base (source de vérité des droits). */
export const abonnementCourant = cache(async (): Promise<InfosAbonnement> => {
  const { supabase, atelier } = await exigerAtelier();
  const [{ data: offre }, { data: ab }] = await Promise.all([
    supabase.rpc("offre_active", { p_atelier: atelier.id }),
    supabase.from("abonnements").select("offre, statut, fin_acces, stripe_customer_id").eq("atelier_id", atelier.id).maybeSingle(),
  ]);
  const active = (offre as IdOffre) ?? "essentiel";
  return {
    offreActive: active,
    offreChoisie: (ab?.offre as IdOffre) ?? "essentiel",
    statut: ab?.statut ?? "actif",
    finAcces: ab?.fin_acces ?? null,
    clientStripe: ab?.stripe_customer_id ?? null,
    estPro: active === "pro" || active === "atelier",
  };
});

export async function exigerPro() {
  const ctx = await exigerAtelier();
  const ab = await abonnementCourant();
  if (!ab.estPro) throw new ErreurOffre();
  return { ...ctx, abonnement: ab };
}

export class ErreurOffre extends Error {
  constructor() {
    super("Cette fonction fait partie de l'offre Pro.");
  }
}

/** Quota de nouvelles demandes (Essentiel) — utilisé par l'API publique avec le client service. */
export async function quotaDemandes(atelierId: string): Promise<{ limite: number | null; utilisees: number; atteint: boolean }> {
  const admin = createAdminClient();
  const [{ data: offre }, { data: n }] = await Promise.all([
    admin.rpc("offre_active", { p_atelier: atelierId }),
    admin.rpc("demandes_du_mois", { p_atelier: atelierId }),
  ]);
  const limite = OFFRES.find((o) => o.id === offre)?.limiteDemandesMois ?? null;
  const utilisees = Number(n ?? 0);
  return { limite, utilisees, atteint: limite !== null && utilisees >= limite };
}
