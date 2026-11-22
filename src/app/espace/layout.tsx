import Link from "next/link";
import { exigerAtelier } from "@/lib/atelier";
import { urlPublique } from "@/lib/navigation";
import { IcoCloche, IcoGateau, IcoSortie } from "@/components/icones";
import { NavLaterale, NavMobile } from "./Navigation";
import { EcouteNotifications } from "./EcouteNotifications";

export const dynamic = "force-dynamic";

export default async function LayoutEspace({ children }: { children: React.ReactNode }) {
  const { supabase, atelier } = await exigerAtelier();

  const [{ count: nouvelles }, { count: nonLues }] = await Promise.all([
    supabase.from("demandes").select("id", { count: "exact", head: true }).eq("atelier_id", atelier.id).eq("statut", "nouvelle"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("atelier_id", atelier.id).is("lue_le", null),
  ]);

  const logo = urlPublique(atelier.logo_path);
  const initiales = atelier.nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]!.toUpperCase()).join("");

  const cloche = (
    <Link href="/espace/notifications" className="cloche" aria-label={`Notifications${nonLues ? ` (${nonLues} non lues)` : ""}`}>
      <IcoCloche taille={24} />
      {!!nonLues && <span className="point-rose" />}
    </Link>
  );

  return (
    <div className="espace">
      <aside className="barre-laterale" aria-label="Navigation principale">
        <Link href="/espace" className="logo-marque">
          <IcoGateau taille={30} /> Atelier Sucré
        </Link>
        <NavLaterale nouvelles={nouvelles ?? 0} nonLues={nonLues ?? 0} />
        <div className="bas">
          <form action="/auth/deconnexion" method="post">
            <button className="lien-nav" style={{ background: "none", border: 0, width: "100%", cursor: "pointer" }}>
              <IcoSortie /> Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <div className="contenu-espace">
        <div className="entete-mobile">
          <Link href="/espace" className="logo-marque">
            <IcoGateau taille={28} /> Atelier Sucré
          </Link>
          <div className="rangee" style={{ gap: 4 }}>
            {cloche}
            <Link href="/espace/menu" className="avatar" aria-label="Menu du compte">
              {logo ? <img src={logo} alt="" /> : initiales}
            </Link>
          </div>
        </div>
        <div className="barre-haut">
          <Link href={`/p/${atelier.slug}`} target="_blank" className="btn btn-fantome btn-petit">
            Voir ma vitrine
          </Link>
          {cloche}
          <span className="avatar" title={atelier.nom}>{logo ? <img src={logo} alt="" /> : initiales}</span>
        </div>
        {children}
      </div>

      <NavMobile nouvelles={nouvelles ?? 0} />
      <EcouteNotifications atelierId={atelier.id} />
    </div>
  );
}
