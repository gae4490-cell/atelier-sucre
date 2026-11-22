"use client";

import { useActionState, useState, useTransition } from "react";
import { changerStatutCommande, enregistrerReglement, lienSolde, majRetraitCommande, type EtatCommande } from "../actions";
import { SUIVANTE } from "@/lib/statuts";
import { centimesVersSaisie, formaterEuros } from "@/lib/argent";
import { BoutonCopier, BoutonEnvoi, MessageEtat } from "@/components/ui";
import type { CommandeSuivi } from "../composants";

export function ActionsCommande({ c }: { c: CommandeSuivi }) {
  const [etat, setEtat] = useState<EtatCommande>(null);
  const [enCours, demarrer] = useTransition();
  const [etatRetrait, actionRetrait] = useActionState(majRetraitCommande, null);
  const [etatReglement, actionReglement] = useActionState(enregistrerReglement, null);
  const suivante = SUIVANTE[c.statut];

  return (
    <>
      <section className="carte pile">
        <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Préparation</h2>
        <MessageEtat etat={etat?.lien ? null : etat} />
        {suivante && (
          <button className="btn btn-primaire" disabled={enCours} onClick={() => demarrer(async () => setEtat(await changerStatutCommande(c.id, suivante.statut)))}>
            {suivante.action}
          </button>
        )}
        {c.statut === "remise" && c.reste_cents > 0 && <p className="alerte alerte-ambre" style={{ margin: 0 }}>Commande remise avec un solde de {formaterEuros(c.reste_cents)} à encaisser.</p>}
      </section>

      {c.reste_cents > 0 && c.statut !== "annulee" && (
        <section className="carte pile">
          <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Solde : {formaterEuros(c.reste_cents)}</h2>
          {etat?.lien && (
            <div className="alerte alerte-succes" style={{ flexDirection: "column" }}>
              <span>{etat.succes}</span>
              <span style={{ overflowWrap: "anywhere", fontWeight: 600 }}>{etat.lien}</span>
              <BoutonCopier texte={etat.lien} className="btn btn-secondaire btn-petit" />
            </div>
          )}
          <button className="btn btn-secondaire" disabled={enCours} onClick={() => demarrer(async () => setEtat(await lienSolde(c.id)))}>
            Envoyer un lien pour le solde
          </button>
          <form action={actionReglement} className="pile" style={{ gap: 8 }}>
            <input type="hidden" name="id" value={c.id} />
            <span className="etiquette" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--texte-doux)" }}>Règlement reçu au retrait</span>
            <div className="rangee" style={{ flexWrap: "nowrap", gap: 8 }}>
              <label className="saisie" style={{ flex: 1, minHeight: 46 }}>
                <span className="visuellement-cache">Montant</span>
                <input name="montant" inputMode="decimal" defaultValue={centimesVersSaisie(c.reste_cents)} style={{ padding: "10px 0" }} />
                <span className="prefixe">€</span>
              </label>
              <label className="saisie" style={{ flex: 1, minHeight: 46 }}>
                <span className="visuellement-cache">Moyen</span>
                <select name="moyen" defaultValue="especes" style={{ padding: "10px 0" }}>
                  <option value="especes">Espèces</option>
                  <option value="carte_sur_place">Carte</option>
                  <option value="virement">Virement</option>
                  <option value="autre">Autre</option>
                </select>
              </label>
            </div>
            <MessageEtat etat={etatReglement} />
            <BoutonEnvoi className="btn btn-fantome" enCours="Enregistrement…">Enregistrer le règlement</BoutonEnvoi>
          </form>
        </section>
      )}

      <section className="carte">
        <h2 style={{ fontSize: "1.2rem" }}>Créneau de retrait</h2>
        <form action={actionRetrait}>
          <input type="hidden" name="id" value={c.id} />
          <label className="champ"><span className="etiquette">Date</span><span className="saisie"><input type="date" name="date_retrait" defaultValue={c.date_retrait ?? ""} /></span></label>
          <label className="champ"><span className="etiquette">Heure ou créneau</span><span className="saisie"><input name="heure_retrait" maxLength={40} defaultValue={c.heure_retrait ?? ""} placeholder="15 h – 16 h" /></span></label>
          <label className="champ"><span className="etiquette">Note interne</span><span className="saisie"><textarea name="note_interne" rows={3} maxLength={2000} defaultValue={c.note_interne ?? ""} style={{ minHeight: 70 }} /></span></label>
          <MessageEtat etat={etatRetrait} />
          <BoutonEnvoi className="btn btn-secondaire" enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
        </form>
      </section>
    </>
  );
}
