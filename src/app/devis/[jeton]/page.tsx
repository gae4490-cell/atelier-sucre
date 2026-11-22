import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hacherJeton, jetonPlausible } from "@/lib/jetons";
import { synchroniserSession } from "@/lib/paiements";
import { modePaiement } from "@/lib/stripe";
import { formaterEuros } from "@/lib/argent";
import { aujourdhuiA, formaterDateCourte } from "@/lib/validation";
import { urlPublique } from "@/lib/navigation";
import { IcoCalendrier, IcoCheck, IcoEtincelle, IcoGateau, IcoPersonnes } from "@/components/icones";
import { BoutonsReponse, BoutonPayer } from "./Client";

export const metadata: Metadata = { title: "Votre devis", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DevisClient({
  params,
  searchParams,
}: {
  params: Promise<{ jeton: string }>;
  searchParams: Promise<{ paiement?: string; session?: string }>;
}) {
  const { jeton } = await params;
  const sp = await searchParams;
  if (!jetonPlausible(jeton)) notFound();
  const admin = createAdminClient();

  if (sp.paiement === "retour" && sp.session) await synchroniserSession(sp.session);

  const { data: dv } = await admin
    .from("devis")
    .select("id, statut, description, total_cents, acompte_cents, valide_jusqu, date_retrait, heure_retrait, mode, modalites, atelier_id, demande_id")
    .eq("jeton_hash", hacherJeton(jeton))
    .maybeSingle();
  if (!dv) notFound();
  const [{ data: atelier }, { data: d }, { data: cmd }] = await Promise.all([
    admin.from("ateliers").select("nom, logo_path, fuseau, zone_retrait, contact_public").eq("id", dv.atelier_id).single(),
    admin.from("demandes").select("prenom, theme, nb_parts, date_souhaitee, photo_path").eq("id", dv.demande_id).single(),
    admin.from("commandes_suivi").select("id, paye_cents, reste_cents, statut").eq("devis_id", dv.id).maybeSingle(),
  ]);
  const photo = d?.photo_path ? (await admin.storage.from("inspirations").createSignedUrl(d.photo_path, 900)).data?.signedUrl : null;
  const aujourdhui = aujourdhuiA(atelier?.fuseau ?? "Europe/Paris");
  const expire = dv.statut === "expire" || ((dv.statut === "envoye" || (dv.statut === "accepte" && !cmd)) && dv.valide_jusqu && dv.valide_jusqu < aujourdhui);
  const quand = [dv.date_retrait && formaterDateCourte(dv.date_retrait), dv.heure_retrait].filter(Boolean).join(", ");

  const entete = (
    <div className="centre" style={{ padding: "26px 0 10px" }}>
      <span className="logo-marque" style={{ justifyContent: "center" }}><IcoGateau taille={30} /> {atelier?.nom}</span>
      <div className="doux" style={{ letterSpacing: "0.2em", fontSize: "0.7rem", textTransform: "uppercase" }}>Gâteaux sur mesure</div>
    </div>
  );

  // Écran « Acompte reçu » (maquette)
  if (cmd && dv.acompte_cents > 0 && cmd.paye_cents >= dv.acompte_cents) {
    return (
      <main className="conteneur-etroit" style={{ paddingBottom: 40 }}>
        {entete}
        <section className="centre">
          <span className="rond-icone" style={{ background: "var(--prune)", color: "#fff" }}><IcoCheck taille={44} /></span>
          <h1 style={{ fontSize: "2.4rem" }}>{cmd.reste_cents === 0 ? "Commande réglée" : "Acompte reçu"}</h1>
        </section>
        <div className="carte-rose centre serif" style={{ fontSize: "2.2rem", color: "var(--prune-fonce)", marginBottom: 14 }}>{formaterEuros(cmd.paye_cents)} payés</div>
        <section className="carte pile" style={{ gap: 10 }}>
          <div className="rangee espace-entre"><span>Total de la commande</span><strong>{formaterEuros(dv.total_cents)}</strong></div>
          <div className="rangee espace-entre"><span>Déjà payé ✓</span><strong style={{ color: "var(--vert)" }}>− {formaterEuros(cmd.paye_cents)}</strong></div>
          <div className="carte-rose rangee espace-entre" style={{ padding: "10px 14px" }}><strong>Reste à payer</strong><strong className="serif" style={{ fontSize: "1.5rem" }}>{formaterEuros(cmd.reste_cents)}</strong></div>
          {quand && <p className="ligne-icone" style={{ margin: 0 }}><IcoCalendrier taille={18} /> {dv.mode === "livraison" ? "Livraison" : "Retrait"} : {quand}</p>}
          {dv.modalites && <p className="petit doux" style={{ margin: 0, whiteSpace: "pre-line" }}>{dv.modalites}</p>}
        </section>
        <p className="btn btn-primaire btn-large" style={{ marginTop: 18 }} role="status"><IcoCheck /> Commande confirmée</p>
        <p className="centre doux petit">Un e-mail de confirmation vous a été envoyé.</p>
      </main>
    );
  }

  return (
    <main className="conteneur-etroit" style={{ paddingBottom: 40 }}>
      {entete}
      <h1 className="centre"><span className="souligne-rose">Votre devis</span></h1>
      {sp.paiement === "annule" && <div className="alerte alerte-info" role="status">Paiement annulé : rien n&apos;a été débité. Vous pouvez réessayer.</div>}
      {sp.paiement === "retour" && !cmd && <div className="alerte alerte-info" role="status">Paiement en cours de confirmation… actualisez la page dans quelques secondes.</div>}

      <section className="carte" style={{ padding: 0, overflow: "hidden" }}>
        <div className="photo photo-large" style={{ borderRadius: 0 }}>
          {photo ? <img src={photo} alt="Votre inspiration" /> : atelier?.logo_path ? <img src={urlPublique(atelier.logo_path) ?? ""} alt="" /> : <IcoGateau taille={48} />}
        </div>
        <div style={{ padding: 18 }}>
          <h2 className="rangee" style={{ fontSize: "1.3rem", gap: 8 }}><IcoGateau /> Gâteau sur mesure</h2>
          <p style={{ whiteSpace: "pre-line" }}>{dv.description}</p>
          <div className="pile" style={{ gap: 6 }}>
            {d?.theme && <span className="ligne-icone"><IcoEtincelle taille={18} /> Thème : {d.theme}</span>}
            {d && <span className="ligne-icone"><IcoPersonnes taille={18} /> {d.nb_parts} parts</span>}
            {quand && <span className="ligne-icone"><IcoCalendrier taille={18} /> {dv.mode === "livraison" ? "Livraison" : "Retrait"} : {quand}</span>}
          </div>
          {dv.modalites && <p className="petit doux" style={{ whiteSpace: "pre-line", marginTop: 10 }}>{dv.modalites}</p>}
          <hr style={{ border: 0, borderTop: "1px solid var(--bordure)", margin: "16px 0" }} />
          <div className="rangee espace-entre"><strong style={{ fontSize: "1.2rem" }}>Total</strong><strong className="serif" style={{ fontSize: "1.9rem", color: "var(--prune-fonce)" }}>{formaterEuros(dv.total_cents)}</strong></div>
          {dv.acompte_cents > 0 && (
            <>
              <div className="rangee espace-entre doux"><span>Acompte à la commande</span><span>{formaterEuros(dv.acompte_cents)}</span></div>
              <div className="rangee espace-entre doux"><span>Solde à régler ensuite</span><span>{formaterEuros(dv.total_cents - dv.acompte_cents)}</span></div>
            </>
          )}
          {dv.valide_jusqu && <p className="petit doux" style={{ margin: "8px 0 0" }}>Valable jusqu&apos;au {formaterDateCourte(dv.valide_jusqu)}</p>}
        </div>
      </section>

      <div style={{ marginTop: 18 }}>
        {expire ? (
          <div className="alerte alerte-ambre" role="status">Ce devis a expiré : il ne peut plus être accepté ni payé. {atelier?.contact_public && `Contact : ${atelier.contact_public}`}</div>
        ) : dv.statut === "envoye" ? (
          <BoutonsReponse jeton={jeton} acompte={dv.acompte_cents} />
        ) : dv.statut === "accepte" && !cmd ? (
          <>
            {modePaiement() === "simulation" && <p className="bandeau-apercu" style={{ borderRadius: 12, marginBottom: 10 }}>Mode test : paiement simulé, aucune carte débitée.</p>}
            <BoutonPayer jeton={jeton} montant={formaterEuros(dv.acompte_cents)} />
          </>
        ) : dv.statut === "accepte" && cmd ? (
          <div className="alerte alerte-succes" role="status">Devis accepté : votre commande est confirmée.</div>
        ) : dv.statut === "refuse" ? (
          <div className="alerte alerte-info">Vous avez refusé ce devis. Le pâtissier peut vous proposer une nouvelle version.</div>
        ) : (
          <div className="alerte alerte-ambre">Ce devis n&apos;est plus valable (remplacé ou retiré par le pâtissier). Utilisez le lien du dernier devis reçu.</div>
        )}
      </div>
    </main>
  );
}
