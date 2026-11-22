"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { enregistrerDevis, renouvelerLienDevis, revoquerDevis, supprimerBrouillonDevis, type EtatDevis } from "../actions";
import { centimesVersSaisie, eurosVersCentimes, formaterEuros } from "@/lib/argent";
import { formaterDateCourte } from "@/lib/validation";
import { BoutonCopier, BoutonEnvoi, MessageEtat } from "@/components/ui";
import { IcoCalendrier, IcoEnvoi, IcoGateau, IcoPersonnes } from "@/components/icones";

type Devis = {
  id: string;
  description: string;
  total_cents: number;
  acompte_cents: number;
  valide_jusqu: string | null;
  date_retrait: string | null;
  heure_retrait: string | null;
  mode: string;
  modalites: string | null;
};

function LienEnvoye({ etat }: { etat: EtatDevis }) {
  if (!etat?.lien) return <MessageEtat etat={etat} />;
  return (
    <div className="alerte alerte-succes" role="status" style={{ flexDirection: "column" }}>
      <span>{etat.succes}</span>
      <span style={{ overflowWrap: "anywhere", fontWeight: 600 }}>{etat.lien}</span>
      <BoutonCopier texte={etat.lien} className="btn btn-secondaire btn-petit" />
    </div>
  );
}

export function EditeurDevis({
  devis,
  resume,
  estPro,
}: {
  devis: Devis;
  resume: { prenom: string; theme: string | null; nbParts: number; date: string } | null;
  estPro: boolean;
}) {
  const [etat, action] = useActionState(enregistrerDevis, null);
  const [total, setTotal] = useState(devis.total_cents ? centimesVersSaisie(devis.total_cents) : "");
  const [acompte, setAcompte] = useState(devis.acompte_cents ? centimesVersSaisie(devis.acompte_cents) : "");
  const t = eurosVersCentimes(total);
  const a = acompte.trim() === "" ? 0 : eurosVersCentimes(acompte);
  const [suppression, demarrer] = useTransition();

  if (etat?.lien) {
    return (
      <div className="pile" style={{ maxWidth: 620 }}>
        <LienEnvoye etat={etat} />
        <Link href={`/espace/devis/${devis.id}`} className="btn btn-fantome">Voir le devis envoyé</Link>
      </div>
    );
  }

  return (
    <form action={action} className="grille-fiche">
      <input type="hidden" name="id" value={devis.id} />
      <div className="pile">
        {resume && (
          <section className="carte-plate pile" style={{ gap: 6 }}>
            <strong className="serif" style={{ fontSize: "1.2rem" }}>Pour {resume.prenom}</strong>
            {resume.theme && <span className="ligne-icone"><IcoGateau taille={18} /> Thème : {resume.theme}</span>}
            <span className="ligne-icone"><IcoPersonnes taille={18} /> {resume.nbParts} parts</span>
            <span className="ligne-icone"><IcoCalendrier taille={18} /> Date souhaitée : {formaterDateCourte(resume.date)}</span>
          </section>
        )}
        <section className="carte">
          <label className="champ">
            <span className="etiquette">Description du gâteau <span className="requis">*</span></span>
            <span className="saisie"><textarea name="description" required maxLength={3000} defaultValue={devis.description} /></span>
          </label>
          <div className="grille-2" style={{ gap: 12 }}>
            <label className="champ">
              <span className="etiquette">Prix total <span className="requis">*</span></span>
              <span className="saisie"><input name="total" inputMode="decimal" required value={total} onChange={(e) => setTotal(e.target.value)} placeholder="80" /><span className="prefixe">€</span></span>
            </label>
            <label className="champ">
              <span className="etiquette">Acompte (facultatif)</span>
              <span className="saisie"><input name="acompte" inputMode="decimal" value={acompte} onChange={(e) => setAcompte(e.target.value)} placeholder="25" /><span className="prefixe">€</span></span>
              {t && !acompte && <button type="button" className="aide" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }} onClick={() => setAcompte(centimesVersSaisie(Math.round(t * 0.3 / 100) * 100))}>Proposer 30 % ({formaterEuros(Math.round(t * 0.3 / 100) * 100)})</button>}
            </label>
          </div>
          <div className="grille-2" style={{ gap: 12 }}>
            <label className="champ">
              <span className="etiquette">Valable jusqu&apos;au <span className="requis">*</span></span>
              <span className="saisie"><input type="date" name="valide_jusqu" required defaultValue={devis.valide_jusqu ?? ""} /></span>
            </label>
            <label className="champ">
              <span className="etiquette">Mode</span>
              <span className="saisie">
                <select name="mode" defaultValue={devis.mode}>
                  <option value="retrait">Retrait</option>
                  <option value="livraison">Livraison</option>
                </select>
              </span>
            </label>
            <label className="champ">
              <span className="etiquette">Date de retrait ou livraison</span>
              <span className="saisie"><input type="date" name="date_retrait" defaultValue={devis.date_retrait ?? ""} /></span>
            </label>
            <label className="champ">
              <span className="etiquette">Heure ou créneau</span>
              <span className="saisie"><input name="heure_retrait" maxLength={40} defaultValue={devis.heure_retrait ?? ""} placeholder="Samedi 14 h – 15 h" /></span>
            </label>
          </div>
          <label className="champ">
            <span className="etiquette">Modalités (lieu, conditions)</span>
            <span className="saisie"><textarea name="modalites" maxLength={600} rows={3} defaultValue={devis.modalites ?? ""} placeholder="Retrait à l'atelier, Lyon 7e. Solde à régler au retrait." style={{ minHeight: 80 }} /></span>
          </label>
        </section>
      </div>

      <aside className="pile">
        <section className="carte">
          <div className="rangee espace-entre"><strong style={{ fontSize: "1.2rem" }}>Total</strong><strong className="serif" style={{ fontSize: "1.8rem", color: "var(--prune)" }}>{t ? formaterEuros(t) : "—"}</strong></div>
          <div className="carte-rose rangee espace-entre" style={{ padding: "10px 14px", marginTop: 10 }}>
            <span>Acompte <span className="doux petit">(à la commande)</span></span><strong>{a ? formaterEuros(a) : "Aucun"}</strong>
          </div>
          {t && a !== null && a <= t && <p className="doux petit" style={{ margin: "10px 0 0" }}>Solde à régler ensuite : {formaterEuros(t - (a ?? 0))}</p>}
          {t && a !== null && a > t && <p className="erreur-champ">L&apos;acompte dépasse le total.</p>}
        </section>
        <MessageEtat etat={etat} />
        {!estPro && (
          <div className="alerte alerte-ambre">
            L&apos;envoi de devis avec acompte fait partie de l&apos;offre Pro. <Link href="/espace/abonnement?offre=pro">Découvrir Pro</Link>
          </div>
        )}
        <BoutonEnvoi className="btn btn-primaire btn-large" name="action" value="envoyer" enCours="Envoi…" disabled={!estPro}>
          <IcoEnvoi /> Envoyer le devis
        </BoutonEnvoi>
        <BoutonEnvoi className="btn btn-secondaire" name="action" value="brouillon" enCours="Enregistrement…">
          Enregistrer le brouillon
        </BoutonEnvoi>
        <button type="button" className="btn btn-danger btn-petit" disabled={suppression}
          onClick={() => { if (window.confirm("Supprimer ce brouillon ?")) demarrer(() => supprimerBrouillonDevis(devis.id)); }}>
          Supprimer le brouillon
        </button>
      </aside>
    </form>
  );
}

export function ActionsDevisEnvoye({ id, statut, aCommande }: { id: string; statut: string; aCommande: boolean }) {
  const [etat, setEtat] = useState<EtatDevis>(null);
  const [enCours, demarrer] = useTransition();
  if (!["envoye", "accepte"].includes(statut)) return null;
  return (
    <section className="carte pile">
      <LienEnvoye etat={etat} />
      <button className="btn btn-secondaire" disabled={enCours} onClick={() => demarrer(async () => setEtat(await renouvelerLienDevis(id)))}>
        Obtenir un nouveau lien privé
      </button>
      {!aCommande && (
        <button className="btn btn-danger" disabled={enCours}
          onClick={() => { if (window.confirm("Révoquer ce devis ? Le client ne pourra plus l'accepter ni le payer.")) demarrer(async () => setEtat(await revoquerDevis(id))); }}>
          Révoquer le devis
        </button>
      )}
      <p className="aide" style={{ margin: 0 }}>Pour modifier le prix, créez un nouveau devis depuis la demande : celui-ci sera remplacé.</p>
    </section>
  );
}
