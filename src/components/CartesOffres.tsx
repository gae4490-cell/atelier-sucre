import Link from "next/link";
import { OFFRES, formaterPrix } from "@/lib/offres";
import { IcoCheck } from "./icones";

export function CartesOffres({ cta }: { cta: (id: string) => { href: string; libelle: string } | null }) {
  return (
    <div className="offres">
      {OFFRES.map((o) => {
        const action = cta(o.id);
        return (
          <article key={o.id} className={`offre ${o.vedette ? "vedette" : ""}`} aria-label={`Offre ${o.nom}`}>
            {o.vedette && <span className="ruban">Le plus choisi</span>}
            {o.aVenir && <span className="ruban" style={{ background: "var(--texte-doux)" }}>À venir</span>}
            <h2 className="centre" style={{ margin: "6px 0 0" }}>{o.nom}</h2>
            <div className="prix">
              {formaterPrix(o.prixMensuelEuros)}<small>/mois</small>
            </div>
            <hr style={{ border: 0, borderTop: "1px solid var(--rose-2)", width: "80%", margin: "0 auto 6px" }} />
            <ul>
              {o.fonctionnalites.map((f) => (
                <li key={f}><IcoCheck taille={18} /> {f}</li>
              ))}
            </ul>
            {o.aVenir ? (
              <button className="btn btn-secondaire btn-large" disabled aria-disabled="true">Bientôt disponible</button>
            ) : action ? (
              <Link href={action.href} className={`btn btn-large ${o.vedette ? "btn-primaire" : "btn-secondaire"}`}>{action.libelle}</Link>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
