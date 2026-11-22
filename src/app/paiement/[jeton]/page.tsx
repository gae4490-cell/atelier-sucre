import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hacherJeton, jetonPlausible } from "@/lib/jetons";
import { ouvrirPaiement, synchroniserSession } from "@/lib/paiements";
import { formaterEuros } from "@/lib/argent";
import { formaterDateCourte } from "@/lib/validation";
import { BoutonEnvoi } from "@/components/ui";
import { IcoCarte, IcoCheck } from "@/components/icones";

export const metadata: Metadata = { title: "Paiement du solde", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PaiementSolde({
  params,
  searchParams,
}: {
  params: Promise<{ jeton: string }>;
  searchParams: Promise<{ paiement?: string; session?: string; erreur?: string }>;
}) {
  const { jeton } = await params;
  const sp = await searchParams;
  if (!jetonPlausible(jeton)) notFound();
  if (sp.paiement === "retour" && sp.session) await synchroniserSession(sp.session);
  const admin = createAdminClient();
  const { data: p } = await admin.from("paiements").select("id, statut, montant_cents, commande_id, atelier_id").eq("jeton_hash", hacherJeton(jeton)).maybeSingle();
  if (!p) notFound();
  const [{ data: c }, { data: a }] = await Promise.all([
    admin.from("commandes_suivi").select("libelle, prenom, email, total_cents, paye_cents, reste_cents, date_retrait, heure_retrait").eq("id", p.commande_id).single(),
    admin.from("ateliers").select("nom").eq("id", p.atelier_id).single(),
  ]);

  async function payer() {
    "use server";
    let url: string;
    try {
      url = await ouvrirPaiement({ paiementId: p!.id, libelle: `Solde — ${a?.nom ?? ""}`, email: c?.email, retour: `/paiement/${jeton}` });
    } catch {
      redirect(`/paiement/${jeton}?erreur=1`);
    }
    redirect(url);
  }

  return (
    <main className="conteneur-etroit" style={{ paddingTop: 40 }}>
      <section className="carte centre">
        <span className="rond-icone">{p.statut === "paye" ? <IcoCheck taille={40} /> : <IcoCarte taille={38} />}</span>
        <p className="doux" style={{ margin: 0 }}>{a?.nom}</p>
        <h1 style={{ fontSize: "1.9rem" }}>{p.statut === "paye" ? "Solde réglé, merci !" : "Solde de votre commande"}</h1>
        <p>{c?.libelle}{c?.date_retrait ? ` · ${formaterDateCourte(c.date_retrait)}${c.heure_retrait ? `, ${c.heure_retrait}` : ""}` : ""}</p>
        <div className="pile" style={{ gap: 6, textAlign: "left", margin: "14px 0" }}>
          <div className="rangee espace-entre"><span>Total</span><strong>{formaterEuros(c?.total_cents)}</strong></div>
          <div className="rangee espace-entre"><span>Déjà payé</span><strong>{formaterEuros(c?.paye_cents)}</strong></div>
          <div className="carte-rose rangee espace-entre" style={{ padding: "10px 14px" }}><strong>Reste à payer</strong><strong>{formaterEuros(c?.reste_cents)}</strong></div>
        </div>
        {sp.erreur && <div className="alerte alerte-erreur">Le paiement n&apos;a pas pu démarrer. Réessayez.</div>}
        {sp.paiement === "annule" && <div className="alerte alerte-info">Paiement annulé : rien n&apos;a été débité.</div>}
        {p.statut === "en_attente" ? (
          <form action={payer}><BoutonEnvoi enCours="Ouverture…">Payer {formaterEuros(p.montant_cents)}</BoutonEnvoi></form>
        ) : p.statut !== "paye" ? (
          <div className="alerte alerte-ambre">Ce lien n&apos;est plus valable. Demandez un nouveau lien au pâtissier.</div>
        ) : null}
      </section>
    </main>
  );
}
