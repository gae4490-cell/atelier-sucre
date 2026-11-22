import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifierSignatureStripe } from "@/lib/stripe-signature";
import { annulerPaiement, confirmerEtNotifier } from "@/lib/paiements";
import { appliquerAbonnementStripe } from "@/lib/abonnements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Evenement = { id: string; type: string; data: { object: Record<string, unknown> & { id: string } } };

/**
 * Webhook Stripe : signature vérifiée, chaque événement traité une seule fois
 * (table stripe_evenements) et chaque confirmation idempotente en base.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ erreur: "STRIPE_WEBHOOK_SECRET manquant" }, { status: 500 });

  const corps = await req.text();
  if (!verifierSignatureStripe(corps, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ erreur: "signature invalide" }, { status: 400 });
  }
  const evt = JSON.parse(corps) as Evenement;
  const admin = createAdminClient();

  const { data: nouveau } = await admin
    .from("stripe_evenements")
    .upsert({ id: evt.id, type: evt.type }, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (!nouveau || nouveau.length === 0) return NextResponse.json({ recu: true, doublon: true });

  try {
    const o = evt.data.object as Record<string, any>;
    switch (evt.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        if (o.mode === "payment" && o.payment_status === "paid") {
          await confirmerEtNotifier({ sessionId: o.id, paymentIntent: o.payment_intent, montantCents: o.amount_total });
        }
        if (o.mode === "subscription" && o.metadata?.atelier_id && o.customer) {
          await admin
            .from("abonnements")
            .update({ stripe_customer_id: o.customer, stripe_subscription_id: o.subscription })
            .eq("atelier_id", o.metadata.atelier_id);
        }
        break;
      case "checkout.session.expired":
        if (o.mode === "payment") await annulerPaiement({ sessionId: o.id, statut: "expire" });
        break;
      case "checkout.session.async_payment_failed":
        await annulerPaiement({ sessionId: o.id, statut: "echoue" });
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await appliquerAbonnementStripe(o as any);
        break;
      default:
        break;
    }
  } catch (e) {
    // On libère l'événement pour que Stripe le renvoie ; le traitement reste idempotent.
    await admin.from("stripe_evenements").delete().eq("id", evt.id);
    console.error("[webhook stripe]", evt.type, e);
    return NextResponse.json({ erreur: "traitement impossible" }, { status: 500 });
  }
  return NextResponse.json({ recu: true });
}
