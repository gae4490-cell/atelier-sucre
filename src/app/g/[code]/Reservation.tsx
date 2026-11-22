"use client";

import { useActionState, useEffect, useState } from "react";
import { reserver } from "./actions";
import { uuid } from "@/lib/image-client";
import { formaterEuros } from "@/lib/argent";
import { BoutonEnvoi } from "@/components/ui";
import { IcoCarte, IcoMail, IcoTelephone, IcoUtilisateur } from "@/components/icones";

export function FormulaireReservation({
  publicationId, code, source, prixCents, max, creneaux, apercu,
}: {
  publicationId: string;
  code: string;
  source: string;
  prixCents: number;
  max: number;
  creneaux: { id: string; libelle: string; places: number | null }[];
  apercu: boolean;
}) {
  const [etat, action] = useActionState(reserver, null);
  const [quantite, setQuantite] = useState(1);
  const [cle, setCle] = useState("");
  useEffect(() => setCle(uuid()), []);
  const err = (c: string) => etat?.erreurs?.[c] ? <p className="erreur-champ" role="alert">{etat.erreurs[c]}</p> : null;

  return (
    <form action={action} className="carte" style={{ marginTop: 12 }}>
      <input type="hidden" name="publication_id" value={publicationId} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="src" value={source} />
      <input type="hidden" name="cle" value={cle} />
      {etat?.erreur && <div className="alerte alerte-erreur" role="alert">{etat.erreur}</div>}
      <fieldset className="champ" style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
        <legend className="etiquette" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--texte-doux)", marginBottom: 6 }}>Créneau de retrait <span className="requis">*</span></legend>
        <div className="pile" style={{ gap: 8 }}>
          {creneaux.map((c, i) => (
            <label key={c.id} className="choix" style={{ justifyContent: "flex-start", textAlign: "left" }}>
              <input type="radio" name="creneau_id" value={c.id} defaultChecked={i === 0} disabled={c.places === 0} />
              <span>{c.libelle}{c.places != null ? <span className="doux petit"> · {c.places === 0 ? "complet" : `${c.places} place${c.places > 1 ? "s" : ""}`}</span> : null}</span>
            </label>
          ))}
        </div>
        {err("creneau_id")}
      </fieldset>
      <label className="champ">
        <span className="etiquette">Quantité</span>
        <span className="saisie">
          <select name="quantite" value={quantite} onChange={(e) => setQuantite(Number(e.target.value))}>
            {Array.from({ length: Math.max(1, max) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </span>
        {err("quantite")}
      </label>
      <label className="champ">
        <span className="etiquette">Prénom <span className="requis">*</span></span>
        <span className="saisie"><IcoUtilisateur /><input name="prenom" autoComplete="given-name" maxLength={60} required /></span>
        {err("prenom")}
      </label>
      <label className="champ">
        <span className="etiquette">E-mail <span className="requis">*</span></span>
        <span className="saisie"><IcoMail /><input name="email" type="email" inputMode="email" autoComplete="email" required /></span>
        {err("email")}
      </label>
      <label className="champ">
        <span className="etiquette">Téléphone <span className="requis">*</span></span>
        <span className="saisie"><IcoTelephone /><input name="telephone" type="tel" inputMode="tel" autoComplete="tel" required /></span>
        {err("telephone")}
      </label>
      <p className="aide" style={{ marginBottom: 12 }}>Votre box est mise de côté pendant le paiement (30 minutes).</p>
      <BoutonEnvoi enCours="Réservation…" disabled={apercu || !cle}>
        <IcoCarte /> Réserver et payer {formaterEuros(prixCents * quantite)}
      </BoutonEnvoi>
    </form>
  );
}
