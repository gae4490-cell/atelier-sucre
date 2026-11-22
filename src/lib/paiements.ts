import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { creerSessionPaiement, expirerSession, lireSession, modePaiement } from "@/lib/stripe";
import { envoyerEmail } from "@/lib/email";
import { emailGenerique } from "@/lib/email-templates";
import { formaterEuros } from "@/lib/argent";
import { formaterDateCourte } from "@/lib/validation";

/**
 * Ouvre le paiement d'une ligne `paiements` déjà créée en base (montant lu en base).
 * Renvoie l'URL vers laquelle rediriger le client.
 */
export async function ouvrirPaiement(o: {
  paiementId: string;
  libelle: string;
  email?: string;
  retour: string; // chemin de la page de retour, ex. /devis/xxx
}): Promise<string> {
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("paiements")
    .select("id, montant_cents, statut, atelier_id, checkout_url, checkout_expire_le")
    .eq("id", o.paiementId)
    .single();
  if (!p || p.statut !== "en_attente") throw new Error("Ce paiement n'est plus disponible.");

  const mode = modePaiement();
  if (mode === "simulation") {
    return `/paiement-simule/${p.id}?retour=${encodeURIComponent(o.retour)}`;
  }
  if (mode === "indisponible") throw new Error("Le paiement en ligne n'est pas encore configuré pour cet atelier.");

  if (p.checkout_url && p.checkout_expire_le && new Date(p.checkout_expire_le).getTime() > Date.now() + 120_000) {
    return p.checkout_url;
  }
  const { data: compte } = await admin
    .from("atelier_paiements")
    .select("stripe_account_id, encaissement_actif")
    .eq("atelier_id", p.atelier_id)
    .maybeSingle();
  const sep = o.retour.includes("?") ? "&" : "?";
  const session = await creerSessionPaiement({
    paiementId: p.id,
    montantCents: p.montant_cents,
    libelle: o.libelle,
    email: o.email,
    urlSucces: `${env.siteUrl}${o.retour}${sep}paiement=retour&session={CHECKOUT_SESSION_ID}`,
    urlAnnulation: `${env.siteUrl}${o.retour}${sep}paiement=annule`,
    compteConnecte: compte?.encaissement_actif ? compte.stripe_account_id : null,
  });
  await admin
    .from("paiements")
    .update({
      checkout_session_id: session.id,
      checkout_url: session.url,
      checkout_expire_le: new Date(session.expires_at * 1000).toISOString(),
    })
    .eq("id", p.id);
  if (!session.url) throw new Error("Stripe n'a pas renvoyé de page de paiement.");
  return session.url;
}

export type ResultatConfirmation = {
  resultat: "confirme" | "deja_traite" | "confirme_a_verifier" | "a_rembourser";
  type: "acompte" | "solde" | "vente_flash" | "manuel";
  paiement_id: string;
  commande_id: string | null;
  atelier_id: string;
};

/** Confirme côté serveur (idempotent) puis envoie les e-mails, sans doublon. */
export async function confirmerEtNotifier(o: {
  paiementId?: string;
  sessionId?: string;
  paymentIntent?: string | null;
  montantCents?: number | null;
}): Promise<ResultatConfirmation> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("confirmer_paiement", {
    p_paiement: o.paiementId ?? null,
    p_session: o.sessionId ?? null,
    p_payment_intent: o.paymentIntent ?? null,
    p_montant_cents: o.montantCents ?? null,
  });
  if (error) throw new Error(error.message);
  const r = (Array.isArray(data) ? data[0] : data) as ResultatConfirmation;
  await envoyerEmailsPaiement(r.paiement_id).catch((e) => console.error("[paiements] e-mails", e));
  return r;
}

export async function annulerPaiement(o: { paiementId?: string; sessionId?: string; statut?: "expire" | "echoue" | "annule" }) {
  const admin = createAdminClient();
  await admin.rpc("annuler_paiement", { p_paiement: o.paiementId ?? null, p_session: o.sessionId ?? null, p_statut: o.statut ?? "expire" });
}

/**
 * Retour de paiement (le client revient sur le site) : on interroge Stripe pour ne pas
 * dépendre uniquement du webhook. Si la page est fermée, le webhook fait le même travail.
 */
export async function synchroniserSession(sessionId: string): Promise<"paye" | "en_attente" | "expire" | "inconnu"> {
  if (modePaiement() !== "stripe" || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return "inconnu";
  try {
    const s = await lireSession(sessionId);
    if (s.mode !== "payment") return "inconnu";
    if (s.payment_status === "paid") {
      await confirmerEtNotifier({ sessionId: s.id, paymentIntent: s.payment_intent, montantCents: s.amount_total });
      return "paye";
    }
    if (s.status === "expired") {
      await annulerPaiement({ sessionId: s.id, statut: "expire" });
      return "expire";
    }
    return "en_attente";
  } catch (e) {
    console.error("[paiements] synchronisation", e);
    return "inconnu";
  }
}

/** Expire côté Stripe les sessions encore ouvertes d'un devis (remplacé/révoqué). */
export async function expirerSessionsDevis(devisIds: string[]) {
  if (modePaiement() !== "stripe" || devisIds.length === 0) return;
  const admin = createAdminClient();
  const { data } = await admin.from("paiements").select("checkout_session_id").in("devis_id", devisIds).not("checkout_session_id", "is", null);
  await Promise.all((data ?? []).map((p) => expirerSession(p.checkout_session_id as string)));
}

/** E-mails de confirmation (client + pâtissier). Clés de déduplication liées au paiement. */
export async function envoyerEmailsPaiement(paiementId: string) {
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("paiements")
    .select("id, type, statut, montant_cents, atelier_id, commande_id, devis_id, reservation_id")
    .eq("id", paiementId)
    .single();
  if (!p || p.statut !== "paye") return;
  const [{ data: atelier }, { data: reglages }, { data: commande }] = await Promise.all([
    admin.from("ateliers").select("nom, zone_retrait").eq("id", p.atelier_id).single(),
    admin.from("atelier_reglages").select("email_notifications").eq("atelier_id", p.atelier_id).single(),
    p.commande_id
      ? admin.from("commandes_suivi").select("*").eq("id", p.commande_id).single()
      : Promise.resolve({ data: null }),
  ]);
  if (!atelier) return;

  if (!commande) {
    // Vente flash payée trop tard (plus de stock) : prévenir le pâtissier uniquement.
    if (reglages?.email_notifications) {
      await envoyerEmail({
        dedupeKey: `paiement:${p.id}:alerte_remboursement`,
        type: "alerte_remboursement",
        atelierId: p.atelier_id,
        demandeId: null,
        to: reglages.email_notifications,
        ...emailGenerique({
          sujet: "Paiement à rembourser",
          titre: "Paiement reçu sans stock disponible",
          paragraphes: [`Un paiement de ${formaterEuros(p.montant_cents)} est arrivé après l'expiration de la réservation et il ne reste plus de stock. Remboursez-le depuis votre tableau de bord Stripe.`],
        }),
      });
    }
    return;
  }

  const lienCommande = `${env.siteUrl}/espace/commandes/${commande.id}`;
  const quand = [commande.date_retrait ? formaterDateCourte(commande.date_retrait) : null, commande.heure_retrait].filter(Boolean).join(", ");
  const lignes: [string, string][] = [
    ["Commande", commande.libelle],
    ["Montant payé", formaterEuros(p.montant_cents)],
    ["Total", formaterEuros(commande.total_cents)],
    ["Reste à payer", formaterEuros(commande.reste_cents)],
  ];
  if (quand) lignes.push([commande.mode === "livraison" ? "Livraison" : "Retrait", quand]);
  if (commande.lieu) lignes.push(["Lieu", commande.lieu]);

  const titreClient =
    p.type === "vente_flash" ? "Réservation confirmée" : p.type === "acompte" ? "Acompte reçu, commande confirmée" : "Paiement reçu";
  await envoyerEmail({
    dedupeKey: `paiement:${p.id}:client`,
    type: `paiement_${p.type}_client`,
    atelierId: p.atelier_id,
    demandeId: commande.demande_id,
    to: commande.email,
    replyTo: reglages?.email_notifications,
    ...emailGenerique({
      sujet: `${titreClient} — ${atelier.nom}`,
      titre: titreClient,
      paragraphes: [`Bonjour ${commande.prenom}, ${atelier.nom} a bien reçu votre paiement de ${formaterEuros(p.montant_cents)}.`],
      lignes,
    }),
  });
  if (reglages?.email_notifications) {
    await envoyerEmail({
      dedupeKey: `paiement:${p.id}:patissier`,
      type: `paiement_${p.type}_patissier`,
      atelierId: p.atelier_id,
      demandeId: commande.demande_id,
      to: reglages.email_notifications,
      replyTo: commande.email,
      ...emailGenerique({
        sujet: `${p.type === "vente_flash" ? "Nouvelle réservation" : "Paiement reçu"} : ${formaterEuros(p.montant_cents)} — ${commande.prenom}`,
        titre: p.type === "vente_flash" ? "Nouvelle réservation" : "Paiement reçu",
        paragraphes: [`${commande.prenom} a payé ${formaterEuros(p.montant_cents)}.`],
        lignes,
        bouton: { libelle: "Voir la commande", url: lienCommande },
      }),
    });
  }
}
