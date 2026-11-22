import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerAtelier } from "@/lib/atelier";
import { abonnementCourant } from "@/lib/acces";
import { UUID_RE } from "@/lib/navigation";
import { DEVIS, type StatutDevis } from "@/lib/statuts";
import { formaterEuros } from "@/lib/argent";
import { formaterDateCourte } from "@/lib/validation";
import { IcoFlecheGauche } from "@/components/icones";
import { ActionsDevisEnvoye, EditeurDevis } from "./Client";

export const metadata: Metadata = { title: "Devis" };

export default async function PageDevis({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase } = await exigerAtelier();
  const { data: dv } = await supabase.from("devis").select("*").eq("id", id).maybeSingle();
  if (!dv) notFound();
  const [{ data: d }, { data: cmd }, ab] = await Promise.all([
    supabase.from("demandes").select("id, numero, prenom, theme, nb_parts, date_souhaitee, photo_path").eq("id", dv.demande_id).single(),
    supabase.from("commandes").select("id").eq("devis_id", id).maybeSingle(),
    abonnementCourant(),
  ]);
  const statut = dv.statut as StatutDevis;

  return (
    <>
      <Link href={`/espace/demandes/${dv.demande_id}`} className="rangee petit" style={{ gap: 6, textDecoration: "none", marginBottom: 8 }}>
        <IcoFlecheGauche taille={16} /> Demande de {d?.prenom}
      </Link>
      <div className="rangee espace-entre" style={{ marginBottom: 16 }}>
        <h1 className="titre-page" style={{ margin: 0 }}>{statut === "brouillon" ? <span className="souligne-rose">Créer un devis</span> : "Devis"}</h1>
        <span className={`badge badge-${DEVIS[statut].ton}`}>{DEVIS[statut].l}</span>
      </div>

      {statut === "brouillon" ? (
        <EditeurDevis
          estPro={ab.estPro}
          devis={{
            id: dv.id,
            description: dv.description,
            total_cents: dv.total_cents,
            acompte_cents: dv.acompte_cents,
            valide_jusqu: dv.valide_jusqu,
            date_retrait: dv.date_retrait,
            heure_retrait: dv.heure_retrait,
            mode: dv.mode,
            modalites: dv.modalites,
          }}
          resume={d ? { prenom: d.prenom, theme: d.theme, nbParts: d.nb_parts, date: d.date_souhaitee } : null}
        />
      ) : (
        <div className="grille-fiche">
          <section className="carte">
            <h2 style={{ fontSize: "1.3rem" }}>Gâteau sur mesure</h2>
            <p style={{ whiteSpace: "pre-line" }}>{dv.description}</p>
            <dl className="liste-def">
              <dt>Total</dt><dd><strong>{formaterEuros(dv.total_cents)}</strong></dd>
              <dt>Acompte</dt><dd>{dv.acompte_cents ? formaterEuros(dv.acompte_cents) : "Aucun"}</dd>
              <dt>Solde</dt><dd>{formaterEuros(dv.total_cents - dv.acompte_cents)}</dd>
              <dt>Valable jusqu&apos;au</dt><dd>{dv.valide_jusqu ? formaterDateCourte(dv.valide_jusqu) : "—"}</dd>
              <dt>{dv.mode === "livraison" ? "Livraison" : "Retrait"}</dt>
              <dd>{[dv.date_retrait && formaterDateCourte(dv.date_retrait), dv.heure_retrait].filter(Boolean).join(", ") || "À convenir"}</dd>
              {dv.modalites && (<><dt>Modalités</dt><dd style={{ whiteSpace: "pre-line" }}>{dv.modalites}</dd></>)}
              {dv.envoye_le && (<><dt>Envoyé le</dt><dd>{new Date(dv.envoye_le).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</dd></>)}
            </dl>
          </section>
          <aside className="pile">
            {cmd && <Link href={`/espace/commandes/${cmd.id}`} className="btn btn-primaire">Voir la commande</Link>}
            <ActionsDevisEnvoye id={dv.id} statut={statut} aCommande={!!cmd} />
          </aside>
        </div>
      )}
    </>
  );
}
