"use client";

export default function ErreurEspace({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="etat-vide" role="alert">
      <p style={{ fontWeight: 600 }}>Cette page n&apos;a pas pu s&apos;afficher.</p>
      <p className="doux petit">Vérifiez votre connexion, puis réessayez.</p>
      <button className="btn btn-primaire" onClick={reset}>Réessayer</button>
    </div>
  );
}
