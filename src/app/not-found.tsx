import Link from "next/link";
import { IcoGateau } from "@/components/icones";

export default function Introuvable() {
  return (
    <main className="conteneur-etroit centre" style={{ paddingTop: 80 }}>
      <IcoGateau taille={56} style={{ color: "var(--prune)", margin: "0 auto 12px" }} />
      <h1 style={{ fontSize: "1.8rem" }}>Page introuvable</h1>
      <p className="doux">Ce lien ne mène nulle part.</p>
      <Link href="/" className="btn btn-fantome">Retour à l&apos;accueil</Link>
    </main>
  );
}
