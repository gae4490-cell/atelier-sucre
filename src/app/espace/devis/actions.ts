"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigerAtelier } from "@/lib/atelier";
import { abonnementCourant } from "@/lib/acces";
import { eurosVersCentimes, formaterEuros } from "@/lib/argent";
import { dateValide, formaterDateCourte, nettoyer } from "@/lib/validation";
import { genererJeton, hacherJeton } from "@/lib/jetons";
import { UUID_RE } from "@/lib/navigation";
import { env } from "@/lib/env";
import { envoyerEmail } from "@/lib/email";
import { emailGenerique } from "@/lib/email-templates";
import { expirerSessionsDevis } from "@/lib/paiements";

export type EtatDevis = { erreur?: string; succes?: string; lien?: string } | null;

const MESSAGES: Record<string, string> = {
  offre_pro_requise: "L'envoi de devis fait partie de l'offre Pro.",
  prix_requis: "Indiquez le prix total.",
  validite_invalide: "La date de validité doit être aujourd'hui ou plus tard.",
  devis_deja_envoye: "Ce devis a déjà été envoyé.",
  devis_non_revocable: "Ce devis ne peut plus être révoqué.",
  commande_existante: "Une commande existe déjà pour ce devis.",
  devis_indisponible: "Ce devis n'est plus actif.",
};
function message(err: { message: string } | null, defaut: string) {
  if (!err) return defaut;
  const cle = Object.keys(MESSAGES).find((k) => err.message.includes(k));
  return cle ? MESSAGES[cle] : defaut;
}

export async function creerBrouillonDevis(demandeId: string) {
  const { supabase, atelier } = await exigerAtelier();
  if (!UUID_RE.test(demandeId)) return;
  const { data: d } = await supabase
    .from("demandes")
    .select("id, theme, parfum, nb_parts, date_souhaitee, mode, type_evenement")
    .eq("id", demandeId)
    .single();
  if (!d) return;
  const description = [
    d.theme ? `Gâteau thème ${d.theme.toLowerCase()}` : "Gâteau sur mesure",
    d.parfum ? d.parfum.toLowerCase() : null,
    `${d.nb_parts} parts`,
  ].filter(Boolean).join(", ");
  const { data: dv, error } = await supabase
    .from("devis")
    .insert({
      atelier_id: atelier.id,
      demande_id: d.id,
      description,
      date_retrait: d.date_souhaitee,
      mode: d.mode,
      valide_jusqu: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error || !dv) throw new Error("Le devis n'a pas pu être créé.");
  redirect(`/espace/devis/${dv.id}`);
}

function lireChamps(fd: FormData) {
  const total = eurosVersCentimes(String(fd.get("total") ?? ""));
  const acompteSaisi = String(fd.get("acompte") ?? "").trim();
  const acompte = acompteSaisi === "" ? 0 : eurosVersCentimes(acompteSaisi);
  const valide = nettoyer(fd.get("valide_jusqu"), 10);
  const dateRetrait = nettoyer(fd.get("date_retrait"), 10);
  const mode = fd.get("mode") === "livraison" ? "livraison" : "retrait";
  if (total === null || total <= 0) return { erreur: "Indiquez le prix total (ex. : 80 ou 80,50)." } as const;
  if (acompte === null) return { erreur: "Le montant de l'acompte est illisible (ex. : 25)." } as const;
  if (acompte > total) return { erreur: "L'acompte ne peut pas dépasser le prix total." } as const;
  if (!dateValide(valide)) return { erreur: "Choisissez une date de validité." } as const;
  if (dateRetrait && !dateValide(dateRetrait)) return { erreur: "La date de retrait est invalide." } as const;
  return {
    champs: {
      description: nettoyer(fd.get("description"), 3000, true),
      total_cents: total,
      acompte_cents: acompte,
      valide_jusqu: valide,
      date_retrait: dateRetrait || null,
      heure_retrait: nettoyer(fd.get("heure_retrait"), 40) || null,
      mode,
      modalites: nettoyer(fd.get("modalites"), 600, true) || null,
    },
  } as const;
}

export async function enregistrerDevis(_: EtatDevis, fd: FormData): Promise<EtatDevis> {
  const { supabase, atelier } = await exigerAtelier();
  const id = String(fd.get("id") ?? "");
  if (!UUID_RE.test(id)) return { erreur: "Devis introuvable." };
  const lu = lireChamps(fd);
  if ("erreur" in lu) return { erreur: lu.erreur };
  if (!lu.champs.description) return { erreur: "Décrivez le gâteau proposé." };

  const { data, error } = await supabase.from("devis").update(lu.champs).eq("id", id).eq("atelier_id", atelier.id).select("id, demande_id");
  if (error || !data?.length) return { erreur: "Le devis n'est plus modifiable (déjà envoyé ?)." };
  revalidatePath(`/espace/devis/${id}`);

  if (fd.get("action") !== "envoyer") return { succes: "Brouillon enregistré." };

  // --- Envoi ---
  const ab = await abonnementCourant();
  if (!ab.estPro) return { erreur: MESSAGES.offre_pro_requise };
  const jeton = genererJeton();
  const { data: anciens } = await supabase.from("devis").select("id").eq("demande_id", data[0].demande_id).eq("statut", "envoye");
  const { error: errEnvoi } = await supabase.rpc("envoyer_devis", { p_devis: id, p_jeton_hash: hacherJeton(jeton) });
  if (errEnvoi) return { erreur: message(errEnvoi, "L'envoi n'a pas abouti.") };
  await expirerSessionsDevis((anciens ?? []).map((a) => a.id));

  const lien = `${env.siteUrl}/devis/${jeton}`;
  const { data: d } = await supabase.from("demandes").select("prenom, email").eq("id", data[0].demande_id).single();
  const { data: reglages } = await supabase.from("atelier_reglages").select("email_notifications").eq("atelier_id", atelier.id).single();
  if (d) {
    const c = lu.champs;
    await envoyerEmail({
      dedupeKey: `devis:${id}:envoi:${hacherJeton(jeton).slice(0, 12)}`,
      type: "devis_envoye",
      atelierId: atelier.id,
      demandeId: data[0].demande_id,
      to: d.email,
      replyTo: reglages?.email_notifications,
      ...emailGenerique({
        sujet: `Votre devis ${atelier.nom} : ${formaterEuros(c.total_cents)}`,
        titre: "Votre devis est prêt",
        paragraphes: [
          `Bonjour ${d.prenom}, ${atelier.nom} vous propose le devis suivant. Vous pouvez l'accepter ou le refuser en ligne, sans créer de compte.`,
        ],
        lignes: [
          ["Gâteau", c.description],
          ["Total", formaterEuros(c.total_cents)],
          ...(c.acompte_cents > 0 ? ([["Acompte à la commande", formaterEuros(c.acompte_cents)]] as [string, string][]) : []),
          ["Valable jusqu'au", formaterDateCourte(c.valide_jusqu)],
        ],
        bouton: { libelle: "Voir mon devis", url: lien },
      }),
    });
  }
  revalidatePath("/espace", "layout");
  return { succes: "Devis envoyé au client par e-mail. Vous pouvez aussi lui transmettre ce lien :", lien };
}

export async function renouvelerLienDevis(id: string): Promise<EtatDevis> {
  const { supabase } = await exigerAtelier();
  if (!UUID_RE.test(id)) return { erreur: "Devis introuvable." };
  const jeton = genererJeton();
  const { error } = await supabase.rpc("renouveler_lien_devis", { p_devis: id, p_jeton_hash: hacherJeton(jeton) });
  if (error) return { erreur: message(error, "Le lien n'a pas pu être renouvelé.") };
  return { succes: "Nouveau lien créé. L'ancien lien ne fonctionne plus.", lien: `${env.siteUrl}/devis/${jeton}` };
}

export async function revoquerDevis(id: string): Promise<EtatDevis> {
  const { supabase } = await exigerAtelier();
  if (!UUID_RE.test(id)) return { erreur: "Devis introuvable." };
  const { error } = await supabase.rpc("revoquer_devis", { p_devis: id });
  if (error) return { erreur: message(error, "Le devis n'a pas pu être révoqué.") };
  await expirerSessionsDevis([id]);
  revalidatePath("/espace", "layout");
  return { succes: "Devis révoqué : le lien ne permet plus de l'accepter ni de payer." };
}

export async function supprimerBrouillonDevis(id: string) {
  const { supabase } = await exigerAtelier();
  if (!UUID_RE.test(id)) return;
  const { data } = await supabase.from("devis").delete().eq("id", id).eq("statut", "brouillon").select("demande_id").maybeSingle();
  revalidatePath("/espace/devis");
  redirect(data?.demande_id ? `/espace/demandes/${data.demande_id}` : "/espace/devis");
}
