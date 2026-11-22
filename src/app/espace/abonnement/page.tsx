import type { Metadata } from "next";
import { exigerAtelier } from "@/lib/atelier";
import { abonnementCourant } from "@/lib/acces";
import { modePaiement } from "@/lib/stripe";
import { OFFRES, formaterPrix } from "@/lib/offres";
import { cheminSur } from "@/lib/navigation";
import { IcoCheck, IcoCouronne } from "@/components/icones";
import { BoutonGerer, BoutonOffre } from "./Client";

export const metadata: Metadata = { title: "Mon abonnement" };

const STATUTS: Record<string, string> = {
  actif: "Actif",
  essai: "Période d'essai",
  en_retard: "Paiement en retard",
  incomplet: "Paiement incomplet",
  annule: "Résilié",
  simule: "Actif (simulation de test)",
};

export default async function Abonnement({ searchParams }: { searchParams: Promise<{ offre?: string; retour?: string; abonnement?: string; change?: string }> }) {
  const { supabase, atelier } = await exigerAtelier();
  const sp = await searchParams;
  const ab = await abonnementCourant();
  const mode = modePaiement();
  const retour = cheminSur(sp.retour, "/espace/abonnement?abonnement=ok");
  const { data: n } = await supabase.rpc("demandes_du_mois", { p_atelier: atelier.id });
  const offre = OFFRES.find((o) => o.id === ab.offreActive)!;

  return (
    <>
      <h1 className="titre-page">Mon abonnement</h1>
      {sp.abonnement === "ok" && <div className="alerte alerte-succes" role="status">Merci ! Votre offre est mise à jour dès confirmation du paiement par Stripe (quelques secondes).</div>}
      {sp.abonnement === "annule" && <div className="alerte alerte-info" role="status">Changement d&apos;offre annulé : rien n&apos;a été débité.</div>}
      {sp.change === "essentiel" && <div className="alerte alerte-info" role="status">Vous êtes repassé(e) à l&apos;offre Essentiel. Vos données et commandes déjà payées sont conservées.</div>}
      {mode === "simulation" && (
        <div className="bandeau-apercu" style={{ borderRadius: 14, marginBottom: 16 }}>
          Facturation simulée : aucune clé Stripe n&apos;est configurée, le changement d&apos;offre est immédiat et gratuit.
        </div>
      )}

      <div className="grille-2" style={{ marginBottom: 26 }}>
        <section className="carte-rose">
          <div className="rangee" style={{ gap: 12, flexWrap: "nowrap" }}>
            <span className="rond-icone" style={{ width: 52, height: 52, margin: 0, background: "#fff" }}><IcoCouronne /></span>
            <div>
              <strong className="serif" style={{ fontSize: "1.5rem" }}>Offre {offre.nom}</strong>
              <div className="serif" style={{ fontSize: "1.8rem", color: "var(--prune-fonce)" }}>{formaterPrix(offre.prixMensuelEuros)}<span className="petit">/mois</span></div>
            </div>
          </div>
          <dl className="liste-def" style={{ marginTop: 12 }}>
            <dt>Statut</dt><dd>{STATUTS[ab.statut] ?? ab.statut}</dd>
            {ab.finAcces && (<><dt>Accès Pro jusqu&apos;au</dt><dd>{new Date(ab.finAcces).toLocaleDateString("fr-FR")}</dd></>)}
            {offre.limiteDemandesMois && (<><dt>Demandes ce mois</dt><dd>{Number(n ?? 0)} / {offre.limiteDemandesMois}</dd></>)}
          </dl>
          {ab.clientStripe && <BoutonGerer />}
        </section>
        <section className="carte">
          <h2 style={{ fontSize: "1.2rem" }}>Deux paiements bien séparés</h2>
          <p className="petit"><strong>Votre abonnement</strong> à Atelier Sucré est réglé à Atelier Sucré (géré ici).</p>
          <p className="petit"><strong>Les gâteaux et ventes flash</strong> sont réglés par vos clients à votre atelier (acomptes, soldes, réservations).</p>
          <p className="petit doux" style={{ margin: 0 }}>
            Pendant le pilote, les paiements clients passent en mode test par le compte de démonstration. L&apos;encaissement direct sur votre compte (Stripe Connect) sera activé atelier par atelier.
          </p>
        </section>
      </div>

      {sp.offre === "pro" && !ab.estPro && (
        <div className="alerte alerte-info">Pro débloque : demandes illimitées, devis avec acompte, suivi des soldes, calendrier, rappels, statistiques de provenance et ventes flash payées en ligne. Vos brouillons sont conservés.</div>
      )}

      <div className="offres">
        {OFFRES.map((o) => (
          <article key={o.id} className={`offre ${o.vedette ? "vedette" : ""}`}>
            {o.aVenir ? <span className="ruban" style={{ background: "var(--texte-doux)" }}>À venir</span> : o.id === ab.offreActive ? <span className="ruban">Votre offre</span> : null}
            <h2 className="centre" style={{ margin: "6px 0 0" }}>{o.nom}</h2>
            <div className="prix">{formaterPrix(o.prixMensuelEuros)}<small>/mois</small></div>
            <ul>{o.fonctionnalites.map((f) => <li key={f}><IcoCheck taille={18} /> {f}</li>)}</ul>
            {o.aVenir ? (
              <button className="btn btn-secondaire btn-large" disabled>Bientôt disponible</button>
            ) : o.id === ab.offreActive ? (
              <button className="btn btn-fantome btn-large" disabled>Offre active</button>
            ) : (
              <BoutonOffre offre={o.id} libelle={o.id === "pro" ? "Passer à Pro" : "Revenir à Essentiel"} retour={o.id === "pro" ? retour : "/espace/abonnement"} vedette={!!o.vedette} />
            )}
          </article>
        ))}
      </div>
    </>
  );
}
