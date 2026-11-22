import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { urlPublique } from "@/lib/navigation";
import { CATEGORIES, FORMATS, type TypePublication } from "@/lib/publications";
import { formaterEuros } from "@/lib/argent";
import { EntetePublique } from "@/components/EntetePublique";
import { IcoChevronBas, IcoEpingle, IcoGateau } from "@/components/icones";

export const metadata: Metadata = { title: "Découvrir", description: "Les dernières créations des pâtissiers et pâtissières, près de chez vous." };
export const dynamic = "force-dynamic";

const LOT = 12;
type Carte = {
  id: string; code: string; type: TypePublication; titre: string; prix_cents: number | null; categorie: string | null;
  publication_photos: { path_vignette: string | null; path: string; position: number }[];
  ateliers: { nom: string; ville: string | null; slug: string };
};

export default async function Decouvrir({ searchParams }: { searchParams: Promise<{ ville?: string; categorie?: string; dispo?: string; lots?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ville = (sp.ville ?? "").slice(0, 80).replace(/[%,()*]/g, "").trim();
  const categorie = CATEGORIES.includes(sp.categorie as (typeof CATEGORIES)[number]) ? sp.categorie! : "";
  const dispo = ["vente_flash", "sur_commande", "creation"].includes(sp.dispo ?? "") ? (sp.dispo as TypePublication) : "";
  const lots = Math.min(10, Math.max(1, Number(sp.lots) || 1));

  let req = supabase
    .from("publications")
    .select("id, code, type, titre, prix_cents, categorie, publiee_le, publication_photos(path, path_vignette, position), ateliers!inner(nom, ville, slug, publie)")
    .eq("statut", "publiee")
    .eq("ateliers.publie", true)
    .order("publiee_le", { ascending: false })
    .range(0, lots * LOT); // un élément de plus pour savoir s'il reste des cartes
  if (ville) req = req.ilike("ateliers.ville", ville);
  if (categorie) req = req.eq("categorie", categorie);
  if (dispo) req = req.eq("type", dispo);
  const [{ data, error }, { data: villesBrutes }] = await Promise.all([
    req,
    supabase.from("ateliers").select("ville").eq("publie", true).not("ville", "is", null).limit(500),
  ]);
  const toutes = (data ?? []) as unknown as Carte[];
  const reste = toutes.length > lots * LOT;
  const cartes = toutes.slice(0, lots * LOT);
  const stocks = new Map(
    await Promise.all(
      cartes.filter((c) => c.type === "vente_flash").map(async (c) => [c.id, (await supabase.rpc("stock_restant", { p_publication: c.id })).data as number | null] as const),
    ),
  );
  const villes = [...new Set<string>((villesBrutes ?? []).map((v) => (v.ville as string).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const params = (extra: Record<string, string>) => {
    const u = new URLSearchParams({ ...(ville && { ville }), ...(categorie && { categorie }), ...(dispo && { dispo }), ...extra });
    return `/decouvrir?${u.toString()}`;
  };

  return (
    <>
      <EntetePublique />
      <main className="conteneur" style={{ paddingBottom: 40 }}>
        <h1>Découvrir</h1>
        <p className="doux" style={{ marginTop: -8 }}>Les dernières créations des ateliers, à commander ou à réserver.</p>
        <form className="filtres" method="get" style={{ gridTemplateColumns: "1fr 1fr 1fr auto" }}>
          <label className="champ">
            <span className="etiquette">Ville</span>
            <span className="saisie">
              <select name="ville" defaultValue={ville}>
                <option value="">Toutes</option>
                {villes.map((v) => <option key={v}>{v}</option>)}
              </select>
              <IcoChevronBas />
            </span>
          </label>
          <label className="champ">
            <span className="etiquette">Catégorie</span>
            <span className="saisie">
              <select name="categorie" defaultValue={categorie}>
                <option value="">Toutes</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <IcoChevronBas />
            </span>
          </label>
          <label className="champ">
            <span className="etiquette">Disponibilité</span>
            <span className="saisie">
              <select name="dispo" defaultValue={dispo}>
                <option value="">Tout</option>
                <option value="vente_flash">Ventes flash</option>
                <option value="sur_commande">Sur commande</option>
                <option value="creation">Créations passées</option>
              </select>
              <IcoChevronBas />
            </span>
          </label>
          <button className="btn btn-secondaire">Filtrer</button>
        </form>

        {error ? (
          <div className="alerte alerte-erreur" role="alert">Le fil n&apos;a pas pu être chargé. <Link href="/decouvrir">Réessayer</Link></div>
        ) : cartes.length === 0 ? (
          <div className="etat-vide">
            <IcoGateau taille={36} />
            <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Aucun gâteau ne correspond</p>
            <p className="doux petit">Essayez une autre ville ou retirez un filtre.</p>
          </div>
        ) : (
          <div className="fil">
            {cartes.map((c) => {
              const photo = [...c.publication_photos].sort((a, b) => a.position - b.position)[0];
              const s = stocks.get(c.id);
              return (
                <Link key={c.id} href={`/g/${c.code}?src=decouvrir`} className="carte-fil">
                  <div className="photo photo-carre">
                    {photo ? <img src={urlPublique(photo.path_vignette ?? photo.path) ?? ""} alt={c.titre} loading="lazy" decoding="async" width={320} height={320} /> : <IcoGateau taille={36} />}
                    <span className={`badge ${c.type === "vente_flash" ? (s === 0 ? "badge-gris" : "badge-vert") : "badge-rose"} etiquette-fil`}>
                      {c.type === "vente_flash" ? (s === 0 ? "Épuisée" : `Vente flash · ${s} restantes`) : FORMATS[c.type].nom}
                    </span>
                  </div>
                  <div style={{ padding: "8px 4px 2px" }}>
                    <strong className="titre-fil">{c.titre}</strong>
                    <span className="petit doux rangee" style={{ gap: 4, flexWrap: "nowrap" }}>
                      {c.ateliers.nom}{c.ateliers.ville ? <> · <IcoEpingle taille={13} /> {c.ateliers.ville}</> : null}
                    </span>
                    {c.prix_cents != null && <strong style={{ color: "var(--prune)" }}>{c.type === "vente_flash" ? "" : "dès "}{formaterEuros(c.prix_cents)}</strong>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {reste && (
          <div className="centre" style={{ marginTop: 22 }}>
            <Link href={params({ lots: String(lots + 1) })} scroll={false} className="btn btn-secondaire">Voir plus de gâteaux</Link>
          </div>
        )}
      </main>
    </>
  );
}
