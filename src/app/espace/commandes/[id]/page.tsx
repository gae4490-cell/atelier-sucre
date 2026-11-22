import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerAtelier } from "@/lib/atelier";
import { UUID_RE } from "@/lib/navigation";
import { formaterEuros } from "@/lib/argent";
import { formaterDateCourte, formaterTelephone } from "@/lib/validation";
import { lienWhatsApp } from "@/lib/whatsapp";
import { IcoFlecheGauche, IcoMail, IcoTelephone, IcoWhatsApp } from "@/components/icones";
import { BadgesCommande, type CommandeSuivi } from "../composants";
import { ActionsCommande } from "./Client";

export const metadata: Metadata = { title: "Commande" };

const MOYENS: Record<string, string> = {
  stripe: "Paiement en ligne",
  simulation: "Paiement simulé (test)",
  especes: "Espèces",
  virement: "Virement",
  carte_sur_place: "Carte sur place",
  autre: "Autre",
};
const TYPES: Record<string, string> = { acompte: "Acompte", solde: "Solde", vente_flash: "Réservation", manuel: "Règlement" };

export default async function FicheCommande({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, atelier } = await exigerAtelier();
  const { data } = await supabase.from("commandes_suivi").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as CommandeSuivi;
  const { data: paiements } = await supabase
    .from("paiements")
    .select("id, type, montant_cents, statut, moyen, paye_le, created_at")
    .eq("commande_id", id)
    .order("created_at");

  const msg = `Bonjour ${c.prenom}, ici ${atelier.nom}. Votre commande « ${c.libelle} » ${c.statut === "prete" ? "est prête" : "est bien confirmée"}${c.date_retrait ? ` pour le ${formaterDateCourte(c.date_retrait)}${c.heure_retrait ? `, ${c.heure_retrait}` : ""}` : ""}.`;

  return (
    <>
      <Link href="/espace/commandes" className="rangee petit" style={{ gap: 6, textDecoration: "none", marginBottom: 8 }}>
        <IcoFlecheGauche taille={16} /> Commandes
      </Link>
      <div className="rangee espace-entre" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="titre-page" style={{ marginBottom: 4 }}>Commande #{c.numero}</h1>
          <span className="doux">{c.prenom} · {c.libelle}</span>
        </div>
        <BadgesCommande c={c} />
      </div>

      <div className="grille-fiche">
        <div className="pile">
          <div className="statuts-separes">
            <div><div className="t">Commande</div><strong><BadgesCommande c={c} /></strong></div>
            <div><div className="t">Reçu</div><strong>{formaterEuros(c.paye_cents)}</strong></div>
            <div><div className="t">Reste</div><strong>{formaterEuros(c.reste_cents)}</strong></div>
          </div>
          <section className="carte">
            <dl className="liste-def">
              <dt>Total</dt><dd>{formaterEuros(c.total_cents)}</dd>
              {c.acompte_cents > 0 && (<><dt>Acompte prévu</dt><dd>{formaterEuros(c.acompte_cents)}</dd></>)}
              <dt>{c.mode === "livraison" ? "Livraison" : "Retrait"}</dt>
              <dd>{c.date_retrait ? formaterDateCourte(c.date_retrait) : "Date à fixer"}{c.heure_retrait ? `, ${c.heure_retrait}` : ""}</dd>
              {c.lieu && (<><dt>Lieu</dt><dd>{c.lieu}</dd></>)}
              <dt>Origine</dt>
              <dd>
                {c.devis_id ? <Link href={`/espace/devis/${c.devis_id}`}>Devis</Link> : "Vente flash"}
                {c.demande_id && <> · <Link href={`/espace/demandes/${c.demande_id}`}>demande</Link></>}
              </dd>
            </dl>
          </section>
          <section className="carte">
            <h2 style={{ fontSize: "1.2rem" }}>Paiements</h2>
            {(paiements ?? []).length === 0 ? <p className="doux petit">Aucun paiement.</p> : (
              <ul className="pile" style={{ padding: 0, margin: 0, gap: 8 }}>
                {(paiements ?? []).map((p) => (
                  <li key={p.id} className="rangee espace-entre" style={{ listStyle: "none" }}>
                    <span>{TYPES[p.type] ?? p.type} · <span className="doux petit">{MOYENS[p.moyen] ?? p.moyen}</span></span>
                    <span className="rangee" style={{ gap: 8 }}>
                      <strong>{formaterEuros(p.montant_cents)}</strong>
                      <span className={`badge ${p.statut === "paye" ? "badge-vert" : p.statut === "en_attente" ? "badge-ambre" : "badge-gris"}`}>
                        {{ paye: "Payé", en_attente: "En attente", expire: "Expiré", echoue: "Échoué", annule: "Annulé" }[p.statut as string]}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="pile">
          <section className="carte pile">
            <a href={lienWhatsApp(c.telephone, msg)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp"><IcoWhatsApp /> WhatsApp</a>
            <a href={`tel:+${c.telephone}`} className="ligne-icone"><IcoTelephone taille={18} /> {formaterTelephone(c.telephone)}</a>
            <a href={`mailto:${c.email}`} className="ligne-icone"><IcoMail taille={18} /> {c.email}</a>
          </section>
          <ActionsCommande c={c} />
        </aside>
      </div>
    </>
  );
}
