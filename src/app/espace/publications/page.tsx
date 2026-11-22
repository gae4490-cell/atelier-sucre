import type { Metadata } from "next";
import Link from "next/link";
import { exigerAtelier } from "@/lib/atelier";
import { abonnementCourant } from "@/lib/acces";
import { urlPublique } from "@/lib/navigation";
import { formaterEuros } from "@/lib/argent";
import { FORMATS, type TypePublication } from "@/lib/publications";
import { BoutonEnvoi } from "@/components/ui";
import { IcoCouronne, IcoPhoto, IcoPlus } from "@/components/icones";
import { creerPublication } from "./actions";

export const metadata: Metadata = { title: "Mes publications" };

export default async function Publications({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { supabase, atelier } = await exigerAtelier();
  const ab = await abonnementCourant();
  const { vue = "toutes" } = await searchParams;
  let req = supabase
    .from("publications")
    .select("id, code, type, statut, titre, prix_cents, stock_total, created_at, publication_photos(path_vignette, position)")
    .eq("atelier_id", atelier.id)
    .order("created_at", { ascending: false });
  if (vue !== "toutes") req = req.eq("statut", vue);
  const { data } = await req.limit(100);
  const liste = (data ?? []) as unknown as {
    id: string; code: string; type: TypePublication; statut: string; titre: string; prix_cents: number | null; stock_total: number | null;
    publication_photos: { path_vignette: string | null; position: number }[];
  }[];
  const stocks = await Promise.all(
    liste.filter((p) => p.type === "vente_flash").map(async (p) => [p.id, (await supabase.rpc("stock_restant", { p_publication: p.id })).data] as const),
  );
  const stock = new Map(stocks);

  return (
    <>
      <div className="rangee espace-entre" style={{ marginBottom: 12 }}>
        <h1 className="titre-page" style={{ margin: 0 }}>Mes publications</h1>
        <div className="rangee">
          <form action={creerPublication.bind(null, "creation")}>
            <BoutonEnvoi className="btn btn-primaire" enCours="Création…"><IcoPlus /> Publier un gâteau</BoutonEnvoi>
          </form>
          <form action={creerPublication.bind(null, "vente_flash")}>
            <BoutonEnvoi className="btn btn-secondaire" enCours="Création…"><IcoCouronne /> Créer une vente flash{ab.estPro ? "" : " · Pro"}</BoutonEnvoi>
          </form>
        </div>
      </div>
      <nav className="onglets">
        {[["toutes", "Toutes"], ["brouillon", "Brouillons"], ["publiee", "En ligne"], ["archivee", "Archivées"]].map(([v, l]) => (
          <Link key={v} href={`/espace/publications?vue=${v}`} className="onglet" aria-current={vue === v ? "true" : undefined}>{l}</Link>
        ))}
      </nav>
      {liste.length === 0 ? (
        <div className="etat-vide">
          <IcoPhoto taille={36} />
          <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Aucune publication ici</p>
          <p className="doux petit">Publiez vos gâteaux : ils apparaîtront sur votre vitrine et dans le fil « Découvrir », avec un lien à partager en story.</p>
        </div>
      ) : (
        <div className="galerie">
          {liste.map((p) => {
            const v = [...p.publication_photos].sort((a, b) => a.position - b.position)[0]?.path_vignette;
            const s = stock.get(p.id);
            return (
              <Link key={p.id} href={`/espace/publications/${p.id}`} className="carte" style={{ padding: 10, textDecoration: "none", color: "inherit" }}>
                <div className="photo photo-carre">{v ? <img src={urlPublique(v) ?? ""} alt="" loading="lazy" /> : <IcoPhoto taille={30} />}</div>
                <div style={{ padding: "8px 2px 0" }}>
                  <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titre || "Sans titre"}</strong>
                  <span className="petit doux">{FORMATS[p.type].nom}{p.prix_cents ? ` · ${formaterEuros(p.prix_cents)}` : ""}{p.type === "vente_flash" && s != null ? ` · ${s}/${p.stock_total}` : ""}</span>
                  <div style={{ marginTop: 6 }}>
                    <span className={`badge ${p.statut === "publiee" ? "badge-vert" : p.statut === "archivee" ? "badge-gris" : "badge-ambre"}`}>
                      {p.statut === "publiee" ? "En ligne" : p.statut === "archivee" ? "Archivée" : "Brouillon"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
