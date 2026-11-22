"use client";

import Link from "next/link";
import { useActionState } from "react";
import { nouveauMotDePasse } from "../actions";
import { BoutonEnvoi, ChampMotDePasse, MessageEtat } from "@/components/ui";
import { MiseEnPageAuth } from "../MiseEnPageAuth";

export default function PageReinitialiser() {
  const [etat, action] = useActionState(nouveauMotDePasse, null);
  return (
    <MiseEnPageAuth titre="Nouveau mot de passe" pied={<Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>}>
      <MessageEtat etat={etat} />
      <form action={action}>
        <div className="champ">
          <ChampMotDePasse name="password" autoComplete="new-password" placeholder="Nouveau mot de passe" minLength={8} />
        </div>
        <div className="champ">
          <ChampMotDePasse name="confirmation" autoComplete="new-password" placeholder="Confirmer le mot de passe" minLength={8} />
        </div>
        <BoutonEnvoi enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
      </form>
    </MiseEnPageAuth>
  );
}
