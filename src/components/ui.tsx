"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { IcoCheck, IcoCopier, IcoOeil, IcoOeilBarre } from "./icones";

/**
 * Bouton d'envoi de formulaire : désactivé pendant l'envoi pour empêcher
 * les doubles soumissions.
 */
export function BoutonEnvoi({
  children,
  enCours = "Envoi…",
  className = "btn btn-primaire btn-large",
  disabled,
  name,
  value,
}: {
  children: React.ReactNode;
  enCours?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending} name={name} value={value}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" /> {enCours}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function ChampMotDePasse({
  name = "password",
  autoComplete = "current-password",
  placeholder = "Mot de passe",
  minLength,
}: {
  name?: string;
  autoComplete?: string;
  placeholder?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="saisie">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      </svg>
      <input
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-label={placeholder}
        required
        minLength={minLength}
      />
      <button
        type="button"
        className="btn-icone btn"
        style={{ minHeight: 36, width: 36, background: "transparent", color: "var(--texte-doux)" }}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {visible ? <IcoOeilBarre /> : <IcoOeil />}
      </button>
    </div>
  );
}

export function BoutonCopier({ texte, libelle = "Copier le lien", className = "btn btn-secondaire" }: { texte: string; libelle?: string; className?: string }) {
  const [copie, setCopie] = useState(false);
  useEffect(() => {
    if (!copie) return;
    const t = setTimeout(() => setCopie(false), 2200);
    return () => clearTimeout(t);
  }, [copie]);

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
    } catch {
      // Contexte non sécurisé (http sur le réseau local) : repli
      const zone = document.createElement("textarea");
      zone.value = texte;
      zone.style.position = "fixed";
      zone.style.opacity = "0";
      document.body.appendChild(zone);
      zone.select();
      try {
        document.execCommand("copy");
        setCopie(true);
      } finally {
        zone.remove();
      }
    }
  }

  return (
    <button type="button" className={className} onClick={copier} aria-live="polite">
      {copie ? <IcoCheck /> : <IcoCopier />} {copie ? "Lien copié" : libelle}
    </button>
  );
}

export function Toast({ message, onFin }: { message: string | null; onFin: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onFin, 3500);
    return () => clearTimeout(t);
  }, [message, onFin]);
  if (!message) return null;
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}

export function MessageEtat({ etat }: { etat: { erreur?: string; succes?: string } | null | undefined }) {
  if (!etat) return null;
  if (etat.erreur) return <div className="alerte alerte-erreur" role="alert">{etat.erreur}</div>;
  if (etat.succes) return <div className="alerte alerte-succes" role="status">{etat.succes}</div>;
  return null;
}
