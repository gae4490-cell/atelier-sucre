import Link from "next/link";

export default function DemandeIntrouvable() {
  return (
    <div className="etat-vide">
      <p style={{ fontWeight: 600 }}>Demande introuvable</p>
      <p className="doux petit">Elle n&apos;existe pas ou n&apos;appartient pas à votre atelier.</p>
      <Link href="/espace/demandes" className="btn btn-fantome">Retour aux demandes</Link>
    </div>
  );
}
