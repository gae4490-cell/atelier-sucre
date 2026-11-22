import type { Metadata } from "next";
import Link from "next/link";
import { exigerAtelier } from "@/lib/atelier";
import { estStatut, LIBELLES, STATUTS_EN_COURS } from "@/lib/statuts";
import { dateValide } from "@/lib/validation";
import { IcoChevronBas, IcoMail, IcoRecherche } from "@/components/icones";
import { CarteDemande, COLONNES_LISTE, urlsPhotos, type DemandeListe } from "./composants";

export const metadata: Metadata = { title: "Mes demandes" };

type SP = { onglet?: string; q?: string; statut?: string; du?: string; au?: string };

export default async function PageDemandes({ searchParams }: { searchParams: Promise<SP> }) {
  const { supabase, atelier } = await exigerAtelier();
  const sp = await searchParams;
  const onglet = sp.onglet === "en-cours" || sp.onglet === "toutes" ? sp.onglet : "nouvelles";
  const q = (sp.q ?? "").slice(0, 60).replace(/[,()*%\\:."']/g, " ").trim();
  const statut = estStatut(sp.statut) ? sp.statut : null;
  const du = sp.du && dateValide(sp.du) ? sp.du : null;
  const au = sp.au && dateValide(sp.au) ? sp.au : null;
  const filtresActifs = !!(q || statut || du || au);

  let requete = supabase.from("demandes").select(COLONNES_LISTE).eq("atelier_id", atelier.id);
  if (statut) requete = requete.eq("statut", statut);
  else if (onglet === "nouvelles") requete = requete.eq("statut", "nouvelle");
  else if (onglet === "en-cours") requete = requete.in("statut", STATUTS_EN_COURS);
  if (q) requete = requete.or(`prenom.ilike.*${q}*,theme.ilike.*${q}*,email.ilike.*${q}*,parfum.ilike.*${q}*`);
  if (du) requete = requete.gte("date_souhaitee", du);
  if (au) requete = requete.lte("date_souhaitee", au);
  requete = onglet === "nouvelles" && !statut ? requete.order("created_at", { ascending: false }) : requete.order("date_souhaitee", { ascending: true });

  const [{ data, error }, { count: nbNouvelles }, { count: nbEnCours }] = await Promise.all([
    requete.limit(100),
    supabase.from("demandes").select("id", { count: "exact", head: true }).eq("atelier_id", atelier.id).eq("statut", "nouvelle"),
    supabase.from("demandes").select("id", { count: "exact", head: true }).eq("atelier_id", atelier.id).in("statut", STATUTS_EN_COURS),
  ]);
  const demandes = (data ?? []) as DemandeListe[];
  const photos = await urlsPhotos(supabase, demandes.map((d) => d.photo_path));

  const lienOnglet = (o: string) => `/espace/demandes?onglet=${o}`;

  return (
    <>
      <h1 className="titre-page">Mes demandes</h1>

      <nav className="onglets" aria-label="Filtrer les demandes">
        <Link href={lienOnglet("nouvelles")} className="onglet" aria-current={onglet === "nouvelles" && !statut ? "true" : undefined}>
          Nouvelle{(nbNouvelles ?? 0) > 1 ? "s" : ""} ({nbNouvelles ?? 0}) {!!nbNouvelles && <span className="point-rose" />}
        </Link>
        <Link href={lienOnglet("en-cours")} className="onglet" aria-current={onglet === "en-cours" && !statut ? "true" : undefined}>
          En cours ({nbEnCours ?? 0})
        </Link>
        <Link href={lienOnglet("toutes")} className="onglet" aria-current={onglet === "toutes" && !statut ? "true" : undefined}>
          Toutes
        </Link>
      </nav>

      <form className="filtres" role="search" method="get">
        <input type="hidden" name="onglet" value={onglet} />
        <label className="champ large">
          <span className="visuellement-cache">Rechercher</span>
          <span className="saisie"><IcoRecherche /><input name="q" defaultValue={q} placeholder="Prénom, thème, e-mail…" /></span>
        </label>
        <label className="champ">
          <span className="etiquette">Statut</span>
          <span className="saisie">
            <select name="statut" defaultValue={statut ?? ""}>
              <option value="">Tous</option>
              {Object.entries(LIBELLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <IcoChevronBas />
          </span>
        </label>
        <label className="champ">
          <span className="etiquette">Gâteau du</span>
          <span className="saisie"><input type="date" name="du" defaultValue={du ?? ""} /></span>
        </label>
        <label className="champ">
          <span className="etiquette">au</span>
          <span className="saisie"><input type="date" name="au" defaultValue={au ?? ""} /></span>
        </label>
        <div className="rangee" style={{ gap: 6 }}>
          <button className="btn btn-secondaire">Filtrer</button>
          {filtresActifs && <Link href={lienOnglet(onglet)} className="btn btn-fantome btn-petit">Effacer</Link>}
        </div>
      </form>

      {error ? (
        <div className="alerte alerte-erreur" role="alert">
          Les demandes n&apos;ont pas pu être chargées. <Link href="/espace/demandes">Réessayer</Link>
        </div>
      ) : demandes.length === 0 ? (
        <div className="etat-vide">
          <IcoMail taille={36} />
          <p style={{ fontWeight: 600, margin: "0 0 4px" }}>
            {filtresActifs ? "Aucune demande ne correspond à ces filtres" : onglet === "nouvelles" ? "Aucune nouvelle demande" : "Aucune demande ici pour l'instant"}
          </p>
          <p className="doux petit" style={{ margin: 0 }}>
            {filtresActifs ? "Modifiez ou effacez les filtres." : "Les demandes envoyées depuis votre vitrine arrivent ici automatiquement."}
          </p>
        </div>
      ) : (
        <div className="grille-2">
          {demandes.map((d) => <CarteDemande key={d.id} d={d} photo={d.photo_path ? photos[d.photo_path] : undefined} />)}
        </div>
      )}
    </>
  );
}
