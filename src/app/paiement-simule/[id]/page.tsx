import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { modePaiement } from "@/lib/stripe";
import { annulerPaiement, confirmerEtNotifier } from "@/lib/paiements";
import { cheminSur, UUID_RE } from "@/lib/navigation";
import { formaterEuros } from "@/lib/argent";
import { IcoCarte } from "@/components/icones";
import { BoutonEnvoi } from "@/components/ui";

export const metadata: Metadata = { title: "Paiement de test", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Page de paiement SIMULÉ : uniquement quand aucune clé Stripe n'est configurée
 * (développement, ou PAIEMENTS_SIMULES=1). Elle appelle exactement la même
 * confirmation serveur que le webhook Stripe.
 */
export default async function PaiementSimule({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retour?: string }>;
}) {
  const { id } = await params;
  const { retour } = await searchParams;
  if (!UUID_RE.test(id) || modePaiement() !== "simulation") notFound();
  const chemin = cheminSur(retour, "/");
  const admin = createAdminClient();
  const { data: p } = await admin.from("paiements").select("id, montant_cents, statut, type, atelier_id").eq("id", id).maybeSingle();
  if (!p) notFound();
  const { data: atelier } = await admin.from("ateliers").select("nom").eq("id", p.atelier_id).single();

  async function payer() {
    "use server";
    await confirmerEtNotifier({ paiementId: id });
    const sep = chemin.includes("?") ? "&" : "?";
    redirect(`${chemin}${sep}paiement=retour`);
  }
  async function abandonner() {
    "use server";
    await annulerPaiement({ paiementId: id, statut: "annule" });
    const sep = chemin.includes("?") ? "&" : "?";
    redirect(`${chemin}${sep}paiement=annule`);
  }

  return (
    <main className="conteneur-etroit" style={{ paddingTop: 40 }}>
      <div className="bandeau-apercu" style={{ borderRadius: 14, marginBottom: 20 }}>
        Paiement simulé — aucune carte n&apos;est débitée. Configurez Stripe en mode test pour un vrai parcours de paiement.
      </div>
      <section className="carte centre">
        <span className="rond-icone"><IcoCarte taille={38} /></span>
        <p className="doux" style={{ margin: 0 }}>{atelier?.nom}</p>
        <h1 style={{ fontSize: "2.4rem", margin: "6px 0 18px" }}>{formaterEuros(p.montant_cents)}</h1>
        {p.statut === "en_attente" ? (
          <div className="pile">
            <form action={payer}>
              <BoutonEnvoi enCours="Paiement…">Payer (simulation)</BoutonEnvoi>
            </form>
            <form action={abandonner}>
              <BoutonEnvoi className="btn btn-fantome btn-large" enCours="…">Abandonner le paiement</BoutonEnvoi>
            </form>
          </div>
        ) : (
          <p className="alerte alerte-info" style={{ justifyContent: "center" }}>
            Ce paiement est déjà {p.statut === "paye" ? "réglé" : "clôturé"}.
          </p>
        )}
      </section>
    </main>
  );
}
