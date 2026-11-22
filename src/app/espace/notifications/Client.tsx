"use client";

import { useActionState, useTransition } from "react";
import { marquerLu } from "./actions";
import { majReglagesNotifications } from "@/lib/actions-vitrine";
import { BoutonEnvoi, MessageEtat } from "@/components/ui";
import type { Reglages } from "@/lib/types";
import { IcoCheck, IcoMail } from "@/components/icones";

export function MarquerLu({ id }: { id: string }) {
  const [enCours, demarrer] = useTransition();
  return (
    <button className="btn btn-fantome btn-petit" disabled={enCours} onClick={() => demarrer(() => marquerLu(id))} aria-label="Marquer comme lue">
      <IcoCheck taille={16} /> Lue
    </button>
  );
}

export function BoutonToutLu() {
  const [enCours, demarrer] = useTransition();
  return (
    <button className="btn btn-secondaire btn-petit" disabled={enCours} onClick={() => demarrer(() => marquerLu("toutes"))}>
      Tout marquer comme lu
    </button>
  );
}

export function PreferencesNotifications({ reglages }: { reglages: Reglages }) {
  const [etat, action] = useActionState(majReglagesNotifications, null);
  return (
    <form action={action}>
      <label className="champ">
        <span className="etiquette">E-mail qui reçoit les nouvelles demandes</span>
        <span className="saisie"><IcoMail /><input type="email" name="email_notifications" required defaultValue={reglages.email_notifications} /></span>
      </label>
      <label className="interrupteur">
        <span>Rappel si une demande reste sans réponse 24 h<span className="doux petit" style={{ display: "block" }}>Offre Pro</span></span>
        <input type="checkbox" name="rappel_demande_24h" defaultChecked={reglages.rappel_demande_24h} />
      </label>
      <label className="interrupteur">
        <span>Récapitulatif quotidien de l&apos;atelier</span>
        <input type="checkbox" name="recap_quotidien" defaultChecked={reglages.recap_quotidien} />
      </label>
      <label className="interrupteur">
        <span>Rappel au client la veille du retrait</span>
        <input type="checkbox" name="rappel_retrait_client" defaultChecked={reglages.rappel_retrait_client} />
      </label>
      <MessageEtat etat={etat} />
      <BoutonEnvoi className="btn btn-primaire" enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
    </form>
  );
}
