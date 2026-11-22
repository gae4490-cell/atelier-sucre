import type { Metadata } from "next";
import Link from "next/link";
import { exigerAtelier } from "@/lib/atelier";
import { IcoBoutique, IcoCalendrier, IcoPhoto, IcoCarte, IcoChevronDroit, IcoCloche, IcoDocument, IcoSac, IcoSortie } from "@/components/icones";

export const metadata: Metadata = { title: "Paramètres" };

export default async function Menu() {
  const { user, atelier } = await exigerAtelier();
  const liens = [
    { href: "/espace/vitrine", libelle: "Ma vitrine", icone: <IcoBoutique /> },
    { href: "/espace/notifications", libelle: "Notifications", icone: <IcoCloche /> },
    { href: "/espace/devis", libelle: "Devis", icone: <IcoDocument /> },
    { href: "/espace/calendrier", libelle: "Calendrier", icone: <IcoCalendrier /> },
    { href: "/espace/publications", libelle: "Mes publications", icone: <IcoPhoto /> },
    { href: "/espace/commandes", libelle: "Commandes", icone: <IcoSac /> },
    { href: "/espace/abonnement", libelle: "Mon abonnement", icone: <IcoCarte /> },
  ];
  return (
    <>
      <h1 className="titre-page">Paramètres</h1>
      <p className="doux">{atelier.nom} · {user.email}</p>
      <nav className="carte" style={{ padding: 6 }}>
        {liens.map((l) => (
          <Link key={l.href} href={l.href} className="rangee espace-entre" style={{ padding: "14px 12px", textDecoration: "none", color: "var(--texte)", borderBottom: "1px solid var(--bordure)" }}>
            <span className="rangee">{l.icone} {l.libelle}</span>
            <IcoChevronDroit />
          </Link>
        ))}
        <form action="/auth/deconnexion" method="post">
          <button className="rangee" style={{ padding: "14px 12px", background: "none", border: 0, width: "100%", color: "var(--rouge)", cursor: "pointer" }}>
            <IcoSortie /> Se déconnecter
          </button>
        </form>
      </nav>
    </>
  );
}
