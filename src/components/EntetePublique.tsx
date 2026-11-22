import Link from "next/link";
import { IcoGateau } from "./icones";

export function EntetePublique({ actif }: { actif?: "tarifs" | "accueil" }) {
  return (
    <header className="conteneur entete-public">
      <Link href="/" className="logo-marque"><IcoGateau taille={34} /> Atelier Sucré</Link>
      <nav className="nav-publique">
        <Link href="/decouvrir">Découvrir</Link>
        <Link href="/#fonctionnalites" className="masque-mobile">Fonctionnalités</Link>
        <Link href="/tarifs" aria-current={actif === "tarifs" ? "page" : undefined}>Tarifs</Link>
        <Link href="/connexion" className="masque-mobile">Connexion</Link>
        <Link href="/inscription" className="btn btn-primaire btn-petit">Essayer gratuitement</Link>
      </nav>
    </header>
  );
}
