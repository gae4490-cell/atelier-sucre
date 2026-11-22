import Link from "next/link";
import { IcoCouronne } from "./icones";

export function BandeauPro({ texte, retour }: { texte: string; retour?: string }) {
  return (
    <div className="alerte alerte-info" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <span className="rangee" style={{ flexWrap: "nowrap" }}><IcoCouronne /> {texte}</span>
      <Link href={`/espace/abonnement?offre=pro${retour ? `&retour=${encodeURIComponent(retour)}` : ""}`} className="btn btn-primaire btn-petit">
        Passer à Pro
      </Link>
    </div>
  );
}
