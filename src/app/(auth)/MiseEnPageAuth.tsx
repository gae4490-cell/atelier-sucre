import Link from "next/link";
import { IcoGateau } from "@/components/icones";

export function MiseEnPageAuth({ titre, children, pied }: { titre: string; children: React.ReactNode; pied?: React.ReactNode }) {
  return (
    <main className="page-auth">
      <div className="conteneur-etroit" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Link href="/" className="marque-centre" style={{ textDecoration: "none" }}>
          <IcoGateau taille={58} style={{ color: "var(--prune)" }} />
          <span className="nom">Atelier Sucré</span>
          <span className="trait" />
        </Link>
        <h1 style={{ fontSize: "2.1rem" }}>{titre}</h1>
        {children}
        {pied && <div style={{ marginTop: 24, textAlign: "center" }}>{pied}</div>}
      </div>
      <div style={{ height: 120 }} />
    </main>
  );
}
