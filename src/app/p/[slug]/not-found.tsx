import Link from "next/link";
import { IcoGateau } from "@/components/icones";

export default function VitrineIntrouvable() {
  return (
    <main className="conteneur-etroit centre" style={{ paddingTop: 80 }}>
      <IcoGateau taille={56} style={{ color: "var(--prune)", margin: "0 auto 12px" }} />
      <h1 style={{ fontSize: "1.8rem" }}>Vitrine introuvable</h1>
      <p className="doux">Ce lien n&apos;existe pas ou la vitrine n&apos;est pas encore publiée. Vérifiez le lien dans la bio Instagram du pâtissier.</p>
      <Link href="/" className="btn btn-fantome">Découvrir Atelier Sucré</Link>
    </main>
  );
}
