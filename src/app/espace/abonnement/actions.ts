"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigerAtelier } from "@/lib/atelier";
import { abonnementCourant } from "@/lib/acces";
import { changerOffreSimulee } from "@/lib/abonnements";
import { creerPortail, creerSessionAbonnement, modePaiement } from "@/lib/stripe";
import { cheminSur } from "@/lib/navigation";
import { env } from "@/lib/env";

export type EtatAbo = { erreur?: string } | null;

export async function choisirOffre(_: EtatAbo, fd: FormData): Promise<EtatAbo> {
  const { user, atelier } = await exigerAtelier();
  const offre = fd.get("offre") === "pro" ? "pro" : fd.get("offre") === "essentiel" ? "essentiel" : null;
  if (!offre) return { erreur: "Offre indisponible." };
  const retour = cheminSur(fd.get("retour"), "/espace/abonnement");
  const mode = modePaiement();

  if (mode === "simulation") {
    await changerOffreSimulee(atelier.id, offre);
    revalidatePath("/espace", "layout");
    redirect(offre === "pro" ? retour : "/espace/abonnement?change=essentiel");
  }
  if (mode === "indisponible") return { erreur: "La facturation n'est pas encore configurée (clés Stripe manquantes)." };

  const ab = await abonnementCourant();
  if (ab.clientStripe && ab.statut !== "annule") {
    // Abonnement existant : le changement d'offre se fait dans le portail Stripe.
    const portail = await creerPortail(ab.clientStripe, `${env.siteUrl}/espace/abonnement`);
    redirect(portail.url);
  }
  let url: string | null;
  try {
    const session = await creerSessionAbonnement({
      atelierId: atelier.id,
      offre,
      clientId: ab.clientStripe,
      email: user.email,
      urlSucces: `${env.siteUrl}${retour}${retour.includes("?") ? "&" : "?"}abonnement=ok`,
      urlAnnulation: `${env.siteUrl}/espace/abonnement?abonnement=annule`,
    });
    url = session.url;
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "Stripe est indisponible." };
  }
  if (!url) return { erreur: "Stripe n'a pas renvoyé de page de paiement." };
  redirect(url);
}

export async function gererAbonnement(): Promise<EtatAbo> {
  await exigerAtelier();
  const ab = await abonnementCourant();
  if (!ab.clientStripe) return { erreur: "Aucun abonnement Stripe associé." };
  const portail = await creerPortail(ab.clientStripe, `${env.siteUrl}/espace/abonnement`);
  redirect(portail.url);
}
