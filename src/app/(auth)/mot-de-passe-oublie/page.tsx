"use client";

import Link from "next/link";
import { useActionState } from "react";
import { motDePasseOublie } from "../actions";
import { BoutonEnvoi, MessageEtat } from "@/components/ui";
import { IcoMail } from "@/components/icones";
import { MiseEnPageAuth } from "../MiseEnPageAuth";

export default function PageMotDePasseOublie() {
  const [etat, action] = useActionState(motDePasseOublie, null);
  return (
    <MiseEnPageAuth titre="Mot de passe oublié" pied={<Link href="/connexion">Retour à la connexion</Link>}>
      <p className="doux">Indiquez votre e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
      <MessageEtat etat={etat} />
      {!etat?.succes && (
        <form action={action}>
          <label className="champ">
            <span className="visuellement-cache">E-mail</span>
            <span className="saisie">
              <IcoMail />
              <input name="email" type="email" inputMode="email" autoComplete="email" placeholder="Email" required defaultValue={etat?.email} />
            </span>
          </label>
          <BoutonEnvoi>Recevoir le lien</BoutonEnvoi>
        </form>
      )}
    </MiseEnPageAuth>
  );
}
