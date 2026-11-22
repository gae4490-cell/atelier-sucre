import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type SousStripe = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end?: number;
  ended_at?: number | null;
  metadata?: Record<string, string>;
  items?: { data: { price: { id: string }; current_period_end?: number }[] };
};

const STATUTS: Record<string, string> = {
  active: "actif",
  trialing: "essai",
  past_due: "en_retard",
  incomplete: "incomplet",
  canceled: "annule",
  unpaid: "annule",
  incomplete_expired: "annule",
  paused: "annule",
};

/** Applique l'état d'un abonnement Stripe (webhook) : les droits suivent la confirmation serveur. */
export async function appliquerAbonnementStripe(s: SousStripe) {
  const admin = createAdminClient();
  const prix = s.items?.data?.[0]?.price?.id;
  const offre =
    s.metadata?.offre === "pro" || prix === process.env.STRIPE_PRICE_PRO
      ? "pro"
      : s.metadata?.offre === "essentiel" || prix === process.env.STRIPE_PRICE_ESSENTIEL
        ? "essentiel"
        : null;
  const statut = STATUTS[s.status] ?? "annule";
  const finPeriode = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  const finAcces =
    statut === "annule"
      ? new Date((s.ended_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString()
      : s.cancel_at_period_end && finPeriode
        ? new Date(finPeriode * 1000).toISOString()
        : null;

  let atelierId = s.metadata?.atelier_id;
  if (!atelierId) {
    const { data } = await admin.from("abonnements").select("atelier_id").eq("stripe_customer_id", s.customer).maybeSingle();
    atelierId = data?.atelier_id;
  }
  if (!atelierId) throw new Error(`Abonnement ${s.id} sans atelier associé`);

  await admin
    .from("abonnements")
    .update({
      ...(offre ? { offre } : {}),
      statut,
      fin_acces: finAcces,
      stripe_customer_id: s.customer,
      stripe_subscription_id: s.id,
    })
    .eq("atelier_id", atelierId);
}

/** Mode simulation (sans clés Stripe) : changement d'offre immédiat, signalé comme simulé. */
export async function changerOffreSimulee(atelierId: string, offre: "essentiel" | "pro") {
  const admin = createAdminClient();
  await admin
    .from("abonnements")
    .update({ offre, statut: offre === "pro" ? "simule" : "actif", fin_acces: null })
    .eq("atelier_id", atelierId);
}
