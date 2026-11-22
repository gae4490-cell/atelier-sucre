"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IcoBoutique, IcoCalendrier, IcoCarte, IcoCloche, IcoDocument, IcoPhoto, IcoMail, IcoMaison, IcoMenu, IcoSac,
} from "@/components/icones";

type Lien = { href: string; libelle: string; icone: React.ReactNode; exact?: boolean; bientot?: boolean };

export function NavLaterale({ nouvelles, nonLues }: { nouvelles: number; nonLues: number }) {
  const chemin = usePathname();
  const liens: (Lien & { compteur?: number })[] = [
    { href: "/espace", libelle: "Accueil", icone: <IcoMaison />, exact: true },
    { href: "/espace/demandes", libelle: "Demandes", icone: <IcoMail />, compteur: nouvelles },
    { href: "/espace/devis", libelle: "Devis", icone: <IcoDocument /> },
    { href: "/espace/commandes", libelle: "Commandes", icone: <IcoSac /> },
    { href: "/espace/calendrier", libelle: "Calendrier", icone: <IcoCalendrier /> },
    { href: "/espace/publications", libelle: "Publications", icone: <IcoPhoto /> },
    { href: "/espace/vitrine", libelle: "Ma vitrine", icone: <IcoBoutique /> },
    { href: "/espace/notifications", libelle: "Notifications", icone: <IcoCloche />, compteur: nonLues },
    { href: "/espace/abonnement", libelle: "Mon abonnement", icone: <IcoCarte /> },
  ];
  return (
    <nav className="pile" style={{ gap: 4 }}>
      {liens.map((l) => {
        const actif = l.exact ? chemin === l.href : chemin.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className="lien-nav" aria-current={actif ? "page" : undefined}>
            {l.icone} {l.libelle}
            {!!l.compteur && <span className="compteur">{l.compteur}</span>}
            {l.bientot && <span className="bientot">bientôt</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function NavMobile({ nouvelles }: { nouvelles: number }) {
  const chemin = usePathname();
  const liens: Lien[] = [
    { href: "/espace", libelle: "Accueil", icone: <IcoMaison taille={24} />, exact: true },
    { href: "/espace/demandes", libelle: "Demandes", icone: <IcoMail taille={24} /> },
    { href: "/espace/publications", libelle: "Gâteaux", icone: <IcoPhoto taille={24} /> },
    { href: "/espace/calendrier", libelle: "Planning", icone: <IcoCalendrier taille={24} /> },
    { href: "/espace/menu", libelle: "Plus", icone: <IcoMenu taille={24} /> },
  ];
  const sousMenu = ["/espace/vitrine", "/espace/notifications", "/espace/abonnement", "/espace/menu", "/espace/devis", "/espace/commandes"];
  return (
    <nav className="nav-mobile" aria-label="Navigation">
      {liens.map((l) => {
        const actif =
          l.href === "/espace/menu" ? sousMenu.some((s) => chemin.startsWith(s)) : l.exact ? chemin === l.href : chemin.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={actif ? "page" : undefined}>
            {l.icone}
            {l.libelle}
            {l.href === "/espace/demandes" && nouvelles > 0 && <span className="point-rose" aria-label={`${nouvelles} nouvelles`} />}
          </Link>
        );
      })}
    </nav>
  );
}
