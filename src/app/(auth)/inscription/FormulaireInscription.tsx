"use client";

import { useActionState } from "react";
import { inscription, renvoyerVerification } from "../actions";
import { BoutonEnvoi, ChampMotDePasse, MessageEtat } from "@/components/ui";
import { IcoMail } from "@/components/icones";

export function FormulaireInscription() {
  const [etat, action] = useActionState(inscription, null);
  const [etatRenvoi, actionRenvoi] = useActionState(renvoyerVerification, null);

  if (etat?.succes) {
    return (
      <div className="pile">
        <div className="alerte alerte-succes" role="status">
          {etat.succes}
        </div>
        <form action={actionRenvoi}>
          <input type="hidden" name="email" value={etat.email ?? ""} />
          <MessageEtat etat={etatRenvoi} />
          <BoutonEnvoi className="btn btn-fantome btn-large">Je n&apos;ai rien reçu, renvoyer</BoutonEnvoi>
        </form>
      </div>
    );
  }

  return (
    <>
      <MessageEtat etat={etat} />
      <form action={action}>
        <label className="champ">
          <span className="visuellement-cache">E-mail</span>
          <span className="saisie">
            <IcoMail />
            <input name="email" type="email" inputMode="email" autoComplete="email" placeholder="Email" required defaultValue={etat?.email} />
          </span>
        </label>
        <div className="champ">
          <ChampMotDePasse autoComplete="new-password" placeholder="Mot de passe (8 caractères minimum)" minLength={8} />
        </div>
        <label className="rangee petit" style={{ alignItems: "flex-start", marginBottom: 18, flexWrap: "nowrap" }}>
          <input type="checkbox" name="cgu" required style={{ marginTop: 4, width: 18, height: 18, accentColor: "var(--prune)" }} />
          <span className="doux">
            J&apos;accepte de participer au pilote d&apos;Atelier Sucré. Mes données et celles de mes clients servent uniquement à gérer les commandes.
          </span>
        </label>
        <BoutonEnvoi enCours="Création…">Créer mon compte</BoutonEnvoi>
      </form>
    </>
  );
}
