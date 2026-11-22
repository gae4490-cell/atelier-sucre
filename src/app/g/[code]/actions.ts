"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { emailValide, nettoyer, normaliserTelephone } from "@/lib/validation";
import { UUID_RE } from "@/lib/navigation";
import { sourceDepuis } from "@/lib/publications";
import { ouvrirPaiement } from "@/lib/paiements";

export type EtatReservation = { erreur?: string; erreurs?: Record<string, string> } | null;

const MESSAGES: Record<string, string> = {
  stock_insuffisant: "Il ne reste plus assez de box disponibles. Réduisez la quantité ou réessayez plus tard.",
  creneau_complet: "Ce créneau est complet. Choisissez-en un autre.",
  creneau_passe: "Ce créneau est passé. Choisissez-en un autre.",
  vente_fermee: "Cette vente est terminée.",
  vente_suspendue: "Les réservations sont momentanément fermées pour cette vente.",
  quantite_invalide: "Quantité non autorisée pour cette vente.",
  creneau_introuvable: "Choisissez un créneau de retrait.",
};

export async function reserver(_: EtatReservation, fd: FormData): Promise<EtatReservation> {
  const publicationId = String(fd.get("publication_id") ?? "");
  const code = String(fd.get("code") ?? "");
  const cle = String(fd.get("cle") ?? "");
  const creneau = String(fd.get("creneau_id") ?? "");
  const quantite = Number(fd.get("quantite"));
  if (!UUID_RE.test(publicationId) || !UUID_RE.test(cle) || !/^[a-f0-9]{10}$/.test(code)) return { erreur: "Rechargez la page et réessayez." };

  const erreurs: Record<string, string> = {};
  const prenom = nettoyer(fd.get("prenom"), 60);
  const email = nettoyer(fd.get("email"), 254).toLowerCase();
  const tel = normaliserTelephone(nettoyer(fd.get("telephone"), 30));
  if (!prenom) erreurs.prenom = "Indiquez votre prénom.";
  if (!emailValide(email)) erreurs.email = "Indiquez un e-mail valide.";
  if (!tel) erreurs.telephone = "Indiquez un numéro de téléphone valide.";
  if (!UUID_RE.test(creneau)) erreurs.creneau_id = "Choisissez un créneau de retrait.";
  if (!Number.isInteger(quantite) || quantite < 1) erreurs.quantite = "Quantité invalide.";
  if (Object.keys(erreurs).length) return { erreur: "Certaines informations sont à corriger.", erreurs };

  const admin = createAdminClient();
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "inconnue").trim();
  const ipHash = createHash("sha256").update(env.rateLimitSalt + ip).digest("hex").slice(0, 32);
  const { data: ok } = await admin.rpc("consommer_quota", { p_cle: `reservation:${ipHash}`, p_max: 10, p_fenetre_secondes: 600 });
  if (ok === false) return { erreur: "Trop de tentatives depuis cet appareil. Réessayez dans quelques minutes." };

  const { data, error } = await admin.rpc("reserver_vente", {
    p_publication: publicationId,
    p_creneau: creneau,
    p_quantite: quantite,
    p_prenom: prenom,
    p_email: email,
    p_telephone: tel,
    p_source: sourceDepuis(fd.get("src")),
    p_cle: cle,
    p_duree_minutes: 35,
  });
  if (error) {
    const k = Object.keys(MESSAGES).find((m) => error.message.includes(m));
    return { erreur: k ? MESSAGES[k] : "La réservation n'a pas pu être enregistrée. Réessayez." };
  }
  const r = (Array.isArray(data) ? data[0] : data) as { reservation_id: string; montant_cents: number };

  // Paiement associé (réutilisé en cas de double envoi)
  const { data: existant } = await admin.from("paiements").select("id, statut").eq("reservation_id", r.reservation_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  let paiementId = existant?.statut === "en_attente" ? existant.id : null;
  if (existant?.statut === "paye") redirect(`/reservation/${r.reservation_id}`);
  if (!paiementId) {
    const { data: atelier } = await admin.from("publications").select("atelier_id").eq("id", publicationId).single();
    const { data: p, error: e2 } = await admin
      .from("paiements")
      .insert({ atelier_id: atelier!.atelier_id, type: "vente_flash", reservation_id: r.reservation_id, montant_cents: r.montant_cents })
      .select("id")
      .single();
    if (e2 || !p) return { erreur: "Le paiement n'a pas pu être préparé." };
    paiementId = p.id;
  }
  const { data: pub } = await admin.from("publications").select("titre").eq("id", publicationId).single();
  let url: string;
  try {
    url = await ouvrirPaiement({ paiementId: paiementId!, libelle: `${quantite} × ${pub?.titre ?? "Vente flash"}`, email, retour: `/reservation/${r.reservation_id}` });
  } catch (e) {
    await admin.rpc("annuler_paiement", { p_paiement: paiementId, p_session: null, p_statut: "annule" });
    return { erreur: e instanceof Error ? e.message : "Le paiement n'a pas pu démarrer." };
  }
  redirect(url);
}
