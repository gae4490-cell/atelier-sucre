"use server";

import { revalidatePath } from "next/cache";
import { exigerAtelier } from "@/lib/atelier";
import { eurosVersCentimes, formaterEuros } from "@/lib/argent";
import { genererJeton, hacherJeton } from "@/lib/jetons";
import { UUID_RE } from "@/lib/navigation";
import { env } from "@/lib/env";
import { dateValide, nettoyer } from "@/lib/validation";
import { COMMANDE, type StatutCommande } from "@/lib/statuts";
import { envoyerEmail } from "@/lib/email";
import { emailGenerique } from "@/lib/email-templates";

export type EtatCommande = { erreur?: string; succes?: string; lien?: string } | null;

export async function changerStatutCommande(id: string, statut: StatutCommande): Promise<EtatCommande> {
  const { supabase, atelier } = await exigerAtelier();
  if (!UUID_RE.test(id) || !(statut in COMMANDE)) return { erreur: "Commande introuvable." };
  const { data, error } = await supabase.from("commandes").update({ statut }).eq("id", id).eq("atelier_id", atelier.id).select("demande_id");
  if (error || !data?.length) return { erreur: "Le statut n'a pas pu être modifié." };
  const statutDemande = { confirmee: "confirmee", en_preparation: "en_preparation", prete: "prete", remise: "remise", annulee: "annulee" }[statut];
  if (data[0].demande_id) await supabase.from("demandes").update({ statut: statutDemande }).eq("id", data[0].demande_id);
  revalidatePath("/espace", "layout");
  return { succes: `Commande : ${COMMANDE[statut].l.toLowerCase()}.` };
}

export async function majRetraitCommande(_: EtatCommande, fd: FormData): Promise<EtatCommande> {
  const { supabase, atelier } = await exigerAtelier();
  const id = String(fd.get("id") ?? "");
  const date = nettoyer(fd.get("date_retrait"), 10);
  if (!UUID_RE.test(id)) return { erreur: "Commande introuvable." };
  if (date && !dateValide(date)) return { erreur: "Date invalide." };
  const { error } = await supabase
    .from("commandes")
    .update({ date_retrait: date || null, heure_retrait: nettoyer(fd.get("heure_retrait"), 40) || null, note_interne: nettoyer(fd.get("note_interne"), 2000, true) || null })
    .eq("id", id)
    .eq("atelier_id", atelier.id);
  if (error) return { erreur: "L'enregistrement a échoué." };
  revalidatePath(`/espace/commandes/${id}`);
  revalidatePath("/espace/calendrier");
  return { succes: "Retrait mis à jour." };
}

export async function lienSolde(id: string): Promise<EtatCommande> {
  const { supabase, atelier } = await exigerAtelier();
  if (!UUID_RE.test(id)) return { erreur: "Commande introuvable." };
  const jeton = genererJeton();
  const { data, error } = await supabase.rpc("creer_paiement_solde", { p_commande: id, p_jeton_hash: hacherJeton(jeton) });
  if (error) return { erreur: error.message.includes("rien_a_payer") ? "Cette commande est déjà réglée." : "Le lien n'a pas pu être créé." };
  const r = (Array.isArray(data) ? data[0] : data) as { paiement_id: string; montant_cents: number };
  const lien = `${env.siteUrl}/paiement/${jeton}`;
  const { data: c } = await supabase.from("commandes").select("prenom, email, libelle").eq("id", id).single();
  if (c) {
    await envoyerEmail({
      dedupeKey: `paiement:${r.paiement_id}:lien_solde`,
      type: "lien_solde",
      atelierId: atelier.id,
      demandeId: null,
      to: c.email,
      ...emailGenerique({
        sujet: `Solde de votre commande — ${atelier.nom}`,
        titre: "Régler le solde",
        paragraphes: [`Bonjour ${c.prenom}, vous pouvez régler le solde de ${formaterEuros(r.montant_cents)} pour « ${c.libelle} » en ligne.`],
        bouton: { libelle: `Payer ${formaterEuros(r.montant_cents)}`, url: lien },
      }),
    });
  }
  revalidatePath(`/espace/commandes/${id}`);
  return { succes: `Lien de paiement de ${formaterEuros(r.montant_cents)} envoyé au client.`, lien };
}

export async function enregistrerReglement(_: EtatCommande, fd: FormData): Promise<EtatCommande> {
  const { supabase } = await exigerAtelier();
  const id = String(fd.get("id") ?? "");
  const montant = eurosVersCentimes(String(fd.get("montant") ?? ""));
  const moyen = String(fd.get("moyen") ?? "");
  if (!UUID_RE.test(id)) return { erreur: "Commande introuvable." };
  if (!montant || montant <= 0) return { erreur: "Indiquez le montant reçu (ex. : 55)." };
  const { data, error } = await supabase.rpc("enregistrer_reglement", { p_commande: id, p_montant_cents: montant, p_moyen: moyen });
  if (error) return { erreur: error.message.includes("montant_invalide") ? "Le montant dépasse le reste à payer." : "Le règlement n'a pas pu être enregistré." };
  revalidatePath("/espace", "layout");
  return { succes: Number(data) === 0 ? "Règlement enregistré : la commande est soldée." : `Règlement enregistré. Reste ${formaterEuros(Number(data))}.` };
}
