"use client";

import { useActionState, useState, useTransition } from "react";
import { choisirOffre, gererAbonnement, type EtatAbo } from "./actions";
import { BoutonEnvoi, MessageEtat } from "@/components/ui";

export function BoutonOffre({ offre, libelle, retour, vedette }: { offre: string; libelle: string; retour: string; vedette: boolean }) {
  const [etat, action] = useActionState(choisirOffre, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (offre === "essentiel" && !window.confirm("Revenir à Essentiel ? Vos données sont conservées, mais vous ne pourrez plus publier de vente flash ni envoyer de devis.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="offre" value={offre} />
      <input type="hidden" name="retour" value={retour} />
      <MessageEtat etat={etat} />
      <BoutonEnvoi className={`btn btn-large ${vedette ? "btn-primaire" : "btn-secondaire"}`} enCours="Redirection…">{libelle}</BoutonEnvoi>
    </form>
  );
}

export function BoutonGerer() {
  const [etat, setEtat] = useState<EtatAbo>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <>
      <MessageEtat etat={etat} />
      <button className="btn btn-primaire" style={{ marginTop: 12 }} disabled={enCours} onClick={() => demarrer(async () => setEtat(await gererAbonnement()))}>
        Gérer mon abonnement ›
      </button>
    </>
  );
}
