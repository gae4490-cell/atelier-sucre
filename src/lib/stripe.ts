import "server-only";
import { encoderStripe } from "@/lib/stripe-signature";

// Client minimal de l'API Stripe (fetch). Mode test imposé pendant le pilote :
// une clé « live » est refusée tant que STRIPE_AUTORISER_LIVE n'est pas explicitement activé.

export type ModePaiement = "stripe" | "simulation" | "indisponible";

export function modePaiement(): ModePaiement {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (cle) return "stripe";
  if (process.env.PAIEMENTS_SIMULES === "1" || process.env.NODE_ENV !== "production") return "simulation";
  return "indisponible";
}

function cleSecrete(): string {
  const cle = process.env.STRIPE_SECRET_KEY ?? "";
  if (!cle) throw new Error("STRIPE_SECRET_KEY manquante");
  if (cle.startsWith("sk_live") && process.env.STRIPE_AUTORISER_LIVE !== "oui") {
    throw new Error("Clé Stripe live refusée : le pilote fonctionne uniquement en mode test.");
  }
  return cle;
}

export class ErreurStripe extends Error {
  constructor(message: string, public statut: number) {
    super(message);
  }
}

async function appel<T>(methode: "GET" | "POST", chemin: string, params?: Record<string, unknown>, idempotence?: string): Promise<T> {
  const url = `https://api.stripe.com/v1/${chemin}${methode === "GET" && params ? `?${encoderStripe(params)}` : ""}`;
  const res = await fetch(url, {
    method: methode,
    headers: {
      Authorization: `Bearer ${cleSecrete()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
      ...(idempotence ? { "Idempotency-Key": idempotence } : {}),
    },
    body: methode === "POST" && params ? encoderStripe(params) : undefined,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const corps = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new ErreurStripe(corps.error?.message ?? `Stripe HTTP ${res.status}`, res.status);
  return corps;
}

export interface SessionStripe {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  amount_total: number | null;
  payment_intent: string | null;
  expires_at: number;
  mode: "payment" | "subscription";
  customer: string | null;
  subscription: string | null;
  metadata: Record<string, string>;
}

export async function creerSessionPaiement(o: {
  paiementId: string;
  montantCents: number;
  libelle: string;
  email?: string;
  urlSucces: string;
  urlAnnulation: string;
  compteConnecte?: string | null;
}): Promise<SessionStripe> {
  // Stripe impose 30 min minimum ; la réservation de stock dure 35 min : la session expire avant.
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60 + 30;
  return appel<SessionStripe>(
    "POST",
    "checkout/sessions",
    {
      mode: "payment",
      expires_at: expiresAt,
      customer_email: o.email,
      success_url: o.urlSucces,
      cancel_url: o.urlAnnulation,
      locale: "fr",
      client_reference_id: o.paiementId,
      metadata: { paiement_id: o.paiementId },
      payment_intent_data: {
        metadata: { paiement_id: o.paiementId },
        ...(o.compteConnecte ? { transfer_data: { destination: o.compteConnecte } } : {}),
      },
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: o.montantCents, product_data: { name: o.libelle.slice(0, 120) } } }],
    },
    `paiement-${o.paiementId}`,
  );
}

export function lireSession(id: string) {
  return appel<SessionStripe>("GET", `checkout/sessions/${encodeURIComponent(id)}`);
}

export async function expirerSession(id: string) {
  try {
    await appel("POST", `checkout/sessions/${encodeURIComponent(id)}/expire`);
  } catch {
    /* déjà terminée ou expirée */
  }
}

export function prixOffre(offre: "essentiel" | "pro"): string | undefined {
  return offre === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_ESSENTIEL;
}

export function creerSessionAbonnement(o: {
  atelierId: string;
  offre: "essentiel" | "pro";
  clientId?: string | null;
  email?: string;
  urlSucces: string;
  urlAnnulation: string;
}) {
  const prix = prixOffre(o.offre);
  if (!prix) throw new Error(`STRIPE_PRICE_${o.offre.toUpperCase()} manquant`);
  return appel<SessionStripe>("POST", "checkout/sessions", {
    mode: "subscription",
    customer: o.clientId ?? undefined,
    customer_email: o.clientId ? undefined : o.email,
    success_url: o.urlSucces,
    cancel_url: o.urlAnnulation,
    locale: "fr",
    client_reference_id: o.atelierId,
    metadata: { atelier_id: o.atelierId, offre: o.offre },
    subscription_data: { metadata: { atelier_id: o.atelierId, offre: o.offre } },
    line_items: [{ price: prix, quantity: 1 }],
  });
}

export function creerPortail(clientId: string, urlRetour: string) {
  return appel<{ url: string }>("POST", "billing_portal/sessions", { customer: clientId, return_url: urlRetour });
}
