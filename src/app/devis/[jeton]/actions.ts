"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hacherJeton, jetonPlausible } from "@/lib/jetons";
import { ouvrirPaiement } from "@/lib/paiements";
import { envoyerEmail } from "@/lib/email";
import { emailGenerique } from "@/lib/email-templates";
import { env } from "@/lib/env";
import { formaterEuros } from "@/lib/argent";

export type EtatReponse = { erreur?: string } | null;

export async function repondre(_: EtatReponse, fd: FormData): Promise<EtatReponse> {
  const jeton = fd.get("jeton");
  if (!jetonPlausible(jeton)) return { erreur: "Lien invalide." };
  const accepter = fd.get("decision") === "accepter";
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("repondre_devis", { p_jeton_hash: hacherJeton(jeton), p_accepter: accepter });
  if (error) return { erreur: error.message.includes("devis_indisponible") ? "Ce devis n'est plus disponible." : "Votre réponse n'a pas pu être enregistrée. Réessayez." };
  const r = (Array.isArray(data) ? data[0] : data) as { devis_id: string; statut: string; commande_id: string | null; acompte_cents: number };

  if (r.statut === "accepte" || r.statut === "refuse") {
    const { data: dv } = await admin.from("devis").select("atelier_id, demande_id, total_cents, demandes(prenom)").eq("id", r.devis_id).single();
    if (dv) {
      const prenom = (dv.demandes as unknown as { prenom: string } | null)?.prenom ?? "Le client";
      await admin.from("notifications").upsert(
        {
          atelier_id: dv.atelier_id,
          demande_id: dv.demande_id,
          type: r.statut === "accepte" ? "devis_accepte" : "devis_refuse",
          titre: `${prenom} a ${r.statut === "accepte" ? "accepté" : "refusé"} le devis`,
          corps: `${formaterEuros(dv.total_cents)}${r.statut === "accepte" && r.acompte_cents ? " · acompte en attente" : ""}`,
          lien: r.commande_id ? `/espace/commandes/${r.commande_id}` : `/espace/devis/${r.devis_id}`,
          dedupe_key: `devis:${r.devis_id}:${r.statut}`,
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      );
      const { data: reg } = await admin.from("atelier_reglages").select("email_notifications").eq("atelier_id", dv.atelier_id).single();
      if (reg?.email_notifications) {
        await envoyerEmail({
          dedupeKey: `devis:${r.devis_id}:${r.statut}:patissier`,
          type: `devis_${r.statut}`,
          atelierId: dv.atelier_id,
          demandeId: dv.demande_id,
          to: reg.email_notifications,
          ...emailGenerique({
            sujet: `${prenom} a ${r.statut === "accepte" ? "accepté" : "refusé"} votre devis`,
            titre: r.statut === "accepte" ? "Devis accepté" : "Devis refusé",
            paragraphes: [
              r.statut === "accepte"
                ? r.acompte_cents ? `${prenom} a accepté le devis. L'acompte de ${formaterEuros(r.acompte_cents)} est en attente de paiement.` : `${prenom} a accepté le devis : la commande est confirmée.`
                : `${prenom} a refusé le devis. Vous pouvez lui proposer une nouvelle version depuis la demande.`,
            ],
            bouton: { libelle: "Ouvrir", url: `${env.siteUrl}/espace/devis/${r.devis_id}` },
          }),
        });
      }
    }
  }
  redirect(`/devis/${jeton}`);
}

export async function payerAcompte(_: EtatReponse, fd: FormData): Promise<EtatReponse> {
  const jeton = fd.get("jeton");
  if (!jetonPlausible(jeton)) return { erreur: "Lien invalide." };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("preparer_paiement_acompte", { p_jeton_hash: hacherJeton(jeton) });
  if (error) {
    const m = error.message;
    return {
      erreur: m.includes("devis_expire")
        ? "Ce devis a expiré : il ne peut plus être payé. Contactez le pâtissier."
        : m.includes("acompte_deja_paye")
          ? "L'acompte a déjà été réglé."
          : "Ce devis ne peut plus être payé (remplacé ou révoqué).",
    };
  }
  const p = (Array.isArray(data) ? data[0] : data) as { paiement_id: string; checkout_url: string | null };
  const { data: dv } = await admin.from("devis").select("demandes(email), ateliers(nom)").eq("jeton_hash", hacherJeton(jeton)).single();
  let url: string;
  try {
    url = p.checkout_url ?? (await ouvrirPaiement({
      paiementId: p.paiement_id,
      libelle: `Acompte — ${(dv?.ateliers as unknown as { nom: string } | null)?.nom ?? "Atelier Sucré"}`,
      email: (dv?.demandes as unknown as { email: string } | null)?.email,
      retour: `/devis/${jeton}`,
    }));
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "Le paiement n'a pas pu démarrer." };
  }
  redirect(url);
}
