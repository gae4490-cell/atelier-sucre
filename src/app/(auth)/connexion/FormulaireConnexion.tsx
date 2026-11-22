"use client";

import Link from "next/link";
import { useActionState } from "react";
import { connexion, renvoyerVerification } from "../actions";
import { BoutonEnvoi, ChampMotDePasse, MessageEtat } from "@/components/ui";
import { IcoMail } from "@/components/icones";

export function FormulaireConnexion({ suivant }: { suivant: string }) {
  const [etat, action] = useActionState(connexion, null);
  const [etatRenvoi, actionRenvoi] = useActionState(renvoyerVerification, null);

  return (
    <>
      <MessageEtat etat={etat} />
      <form action={action} noValidate>
        <input type="hidden" name="suivant" value={suivant} />
        <label className="champ">
          <span className="visuellement-cache">E-mail</span>
          <span className="saisie">
            <IcoMail />
            <input name="email" type="email" inputMode="email" autoComplete="email" placeholder="Email" required defaultValue={etat?.email} />
          </span>
        </label>
        <div className="champ">
          <ChampMotDePasse />
        </div>
        <p style={{ textAlign: "right", margin: "-4px 0 18px" }}>
          <Link href="/mot-de-passe-oublie" className="petit">
            Mot de passe oublié ?
          </Link>
        </p>
        <BoutonEnvoi enCours="Connexion…">Se connecter</BoutonEnvoi>
      </form>

      {etat?.nonVerifie && (
        <form action={actionRenvoi} style={{ marginTop: 18 }}>
          <input type="hidden" name="email" value={etat.email ?? ""} />
          <MessageEtat etat={etatRenvoi} />
          <BoutonEnvoi className="btn btn-fantome btn-large" enCours="Envoi…">
            Renvoyer l&apos;e-mail de vérification
          </BoutonEnvoi>
        </form>
      )}
    </>
  );
}
