"use client";

import { useActionState, useState, useTransition } from "react";
import { enregistrerNote, changerStatutSimple } from "./actions";
import { BoutonEnvoi, MessageEtat } from "@/components/ui";
import { lienWhatsApp } from "@/lib/whatsapp";
import { IcoWhatsApp } from "@/components/icones";

export function RepondreWhatsApp({ telephone, messageInitial }: { telephone: string; messageInitial: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState(messageInitial);
  if (!ouvert) {
    return (
      <button type="button" className="btn btn-whatsapp btn-large" onClick={() => setOuvert(true)}>
        <IcoWhatsApp /> Répondre sur WhatsApp
      </button>
    );
  }
  return (
    <div className="carte-plate">
      <label className="champ">
        <span className="etiquette">Message prérempli (modifiable)</span>
        <span className="saisie">
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={1500} />
        </span>
      </label>
      <div className="rangee">
        <a href={lienWhatsApp(telephone, message)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp" style={{ flex: 1 }}>
          <IcoWhatsApp /> Ouvrir WhatsApp
        </a>
        <button type="button" className="btn btn-fantome" onClick={() => setOuvert(false)}>Annuler</button>
      </div>
      <p className="aide">WhatsApp s&apos;ouvre avec ce message : vous pourrez encore le modifier avant de l&apos;envoyer.</p>
    </div>
  );
}

export function NotePrivee({ id, note }: { id: string; note: string | null }) {
  const [etat, action] = useActionState(enregistrerNote, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <label className="champ">
        <span className="etiquette">Note privée (visible uniquement par vous)</span>
        <span className="saisie">
          <textarea name="note_privee" defaultValue={note ?? ""} maxLength={4000} placeholder="Idées, contraintes, prix envisagé…" />
        </span>
      </label>
      <MessageEtat etat={etat} />
      <BoutonEnvoi className="btn btn-secondaire" enCours="Enregistrement…">Enregistrer la note</BoutonEnvoi>
    </form>
  );
}

export function ActionStatut({ id, statut }: { id: string; statut: string }) {
  const [enCours, demarrer] = useTransition();
  const [etat, setEtat] = useState<{ erreur?: string; succes?: string } | null>(null);
  if (statut !== "nouvelle" && statut !== "refusee") return null;
  const cible = statut === "nouvelle" ? "refusee" : "nouvelle";
  return (
    <div>
      <MessageEtat etat={etat} />
      <button
        type="button"
        className={statut === "nouvelle" ? "btn btn-danger btn-petit" : "btn btn-fantome btn-petit"}
        disabled={enCours}
        onClick={() => {
          if (cible === "refusee" && !window.confirm("Décliner cette demande ? Vous pourrez la rouvrir plus tard.")) return;
          demarrer(async () => setEtat(await changerStatutSimple(id, cible)));
        }}
      >
        {enCours ? "…" : statut === "nouvelle" ? "Décliner la demande" : "Rouvrir la demande"}
      </button>
    </div>
  );
}
