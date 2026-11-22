"use client";

import { useActionState } from "react";
import { payerAcompte, repondre } from "./actions";
import { BoutonEnvoi, MessageEtat } from "@/components/ui";
import { IcoCarte, IcoCheck } from "@/components/icones";

export function BoutonsReponse({ jeton, acompte }: { jeton: string; acompte: number }) {
  const [etat, action] = useActionState(repondre, null);
  return (
    <form action={action} className="pile">
      <input type="hidden" name="jeton" value={jeton} />
      <MessageEtat etat={etat} />
      <BoutonEnvoi name="decision" value="accepter" enCours="Enregistrement…">
        <IcoCheck /> {acompte > 0 ? "Accepter le devis" : "Accepter et confirmer la commande"}
      </BoutonEnvoi>
      <BoutonEnvoi name="decision" value="refuser" className="btn btn-fantome btn-large" enCours="Enregistrement…">
        Refuser
      </BoutonEnvoi>
    </form>
  );
}

export function BoutonPayer({ jeton, montant }: { jeton: string; montant: string }) {
  const [etat, action] = useActionState(payerAcompte, null);
  return (
    <form action={action}>
      <input type="hidden" name="jeton" value={jeton} />
      <MessageEtat etat={etat} />
      <BoutonEnvoi enCours="Ouverture du paiement…">
        <IcoCarte /> Payer {montant} d&apos;acompte
      </BoutonEnvoi>
    </form>
  );
}
