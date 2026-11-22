import type { Metadata } from "next";
import Link from "next/link";
import { exigerAtelier } from "@/lib/atelier";
import { lienVitrine } from "@/lib/navigation";
import { aujourdhuiA, ajouterJours } from "@/lib/validation";
import { BoutonCopier } from "@/components/ui";
import { IcoInstagram, IcoMail } from "@/components/icones";
import { CarteDemande, COLONNES_LISTE, urlsPhotos, type DemandeListe } from "./demandes/composants";
import { abonnementCourant } from "@/lib/acces";
import { creerPublication } from "./publications/actions";
import { BoutonEnvoi } from "@/components/ui";
import { IcoCouronne, IcoPlus } from "@/components/icones";
import { formaterEuros } from "@/lib/argent";
import { formaterDateCourte } from "@/lib/validation";
import { SOURCES } from "@/lib/statuts";
import { OFFRES } from "@/lib/offres";

export const metadata: Metadata = { title: "Accueil" };

export default async function Accueil({ searchParams }: { searchParams: Promise<{ bienvenue?: string; mdp?: string }> }) {
  const { supabase, atelier } = await exigerAtelier();
  const sp = await searchParams;
  const aujourdhui = aujourdhuiA(atelier.fuseau);
  const ab = await abonnementCourant();

  const [{ data: nouvelles, count: nbNouvelles }, { count: nbEnCours }, { count: nbSemaine }] = await Promise.all([
    supabase
      .from("demandes")
      .select(COLONNES_LISTE, { count: "exact" })
      .eq("atelier_id", atelier.id)
      .eq("statut", "nouvelle")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("demandes")
      .select("id", { count: "exact", head: true })
      .eq("atelier_id", atelier.id)
      .in("statut", ["devis_envoye", "acompte_en_attente", "confirmee", "en_preparation", "prete"]),
    supabase
      .from("demandes")
      .select("id", { count: "exact", head: true })
      .eq("atelier_id", atelier.id)
      .not("statut", "in", "(refusee,annulee,remise)")
      .gte("date_souhaitee", aujourdhui)
      .lte("date_souhaitee", ajouterJours(aujourdhui, 7)),
  ]);

  const [{ data: aEncaisser }, { data: retraits }, { data: nMois }, { data: devisStats }, { data: sourcesBrutes }] = await Promise.all([
    supabase.from("commandes_suivi").select("reste_cents").eq("atelier_id", atelier.id).neq("statut", "annulee").gt("reste_cents", 0),
    supabase.from("commandes").select("id, prenom, libelle, date_retrait, heure_retrait").eq("atelier_id", atelier.id)
      .in("statut", ["confirmee", "en_preparation", "prete"]).gte("date_retrait", aujourdhui).order("date_retrait").limit(5),
    supabase.rpc("demandes_du_mois", { p_atelier: atelier.id }),
    supabase.from("devis").select("statut").eq("atelier_id", atelier.id).neq("statut", "brouillon"),
    supabase.from("demandes").select("source").eq("atelier_id", atelier.id).gte("created_at", new Date(Date.now() - 90 * 86400_000).toISOString()),
  ]);
  const soldes = (aEncaisser ?? []).reduce((t, c) => t + (c.reste_cents as number), 0);
  const limite = OFFRES.find((o) => o.id === ab.offreActive)?.limiteDemandesMois ?? null;
  const devisRepondus = (devisStats ?? []).filter((x) => ["accepte", "refuse", "expire"].includes(x.statut));
  const taux = devisRepondus.length ? Math.round((100 * devisRepondus.filter((x) => x.statut === "accepte").length) / devisRepondus.length) : null;
  const sources = new Map<string, number>();
  for (const d of sourcesBrutes ?? []) sources.set(d.source, (sources.get(d.source) ?? 0) + 1);
  const liste = (nouvelles ?? []) as DemandeListe[];
  const photos = await urlsPhotos(supabase, liste.map((d) => d.photo_path));
  const lien = lienVitrine(atelier.slug);

  return (
    <>
      <h1 className="titre-page">Bonjour 👋</h1>
      <p className="doux" style={{ marginTop: -6 }}>{atelier.nom}</p>
      <div className="rangee" style={{ marginBottom: 16 }}>
        <form action={creerPublication.bind(null, "creation")}>
          <BoutonEnvoi className="btn btn-primaire btn-petit" enCours="Création…"><IcoPlus /> Publier un gâteau</BoutonEnvoi>
        </form>
        <form action={creerPublication.bind(null, "vente_flash")}>
          <BoutonEnvoi className="btn btn-secondaire btn-petit" enCours="Création…"><IcoCouronne /> Créer une vente flash{ab.estPro ? "" : " · Pro"}</BoutonEnvoi>
        </form>
      </div>

      {sp.bienvenue && <div className="alerte alerte-succes" role="status">Votre vitrine est en ligne. Copiez le lien ci-dessous dans votre bio Instagram.</div>}
      {sp.mdp && <div className="alerte alerte-succes" role="status">Votre mot de passe a été modifié.</div>}

      {!atelier.publie && (
        <div className="alerte alerte-ambre" role="status" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <span>Votre vitrine n&apos;est pas encore publiée : vos clients ne peuvent pas encore envoyer de demande.</span>
          <Link href="/espace/vitrine" className="btn btn-primaire btn-petit">Publier</Link>
        </div>
      )}

      <div className="grille-stats">
        <div className="stat"><div className="valeur">{nbNouvelles ?? 0}</div><div className="libelle">Nouvelles demandes</div></div>
        <div className="stat"><div className="valeur">{nbSemaine ?? 0}</div><div className="libelle">Gâteaux dans les 7 jours</div></div>
        {ab.estPro ? (
          <Link href="/espace/commandes?vue=solde" className="stat" style={{ textDecoration: "none" }}><div className="valeur">{formaterEuros(soldes)}</div><div className="libelle">Soldes à encaisser</div></Link>
        ) : (
          <div className="stat"><div className="valeur">{Number(nMois ?? 0)}/{limite}</div><div className="libelle">Demandes ce mois (Essentiel)</div></div>
        )}
      </div>

      <div className="grille-fiche">
        <section>
          <div className="rangee espace-entre" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Nouvelles demandes</h2>
            <Link href="/espace/demandes" className="petit">Tout voir</Link>
          </div>
          {liste.length === 0 ? (
            <div className="etat-vide">
              <IcoMail taille={36} />
              <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Aucune nouvelle demande</p>
              <p className="doux petit" style={{ margin: 0 }}>
                {nbEnCours ? `${nbEnCours} demande${nbEnCours > 1 ? "s" : ""} en cours. ` : ""}Partagez votre lien pour en recevoir.
              </p>
            </div>
          ) : (
            <div className="pile">
              {liste.map((d) => <CarteDemande key={d.id} d={d} photo={d.photo_path ? photos[d.photo_path] : undefined} />)}
            </div>
          )}
        </section>

        <aside className="pile">
          <div className="carte">
            <h3 className="rangee" style={{ gap: 8 }}><IcoInstagram /> Lien pour votre bio</h3>
            <p style={{ overflowWrap: "anywhere", fontWeight: 600, margin: "0 0 12px" }}>{lien}</p>
            <div className="rangee">
              <BoutonCopier texte={`${lien}?src=instagram`} libelle="Copier mon lien Instagram" className="btn btn-secondaire btn-petit" />
              <Link href={`/p/${atelier.slug}`} target="_blank" className="btn btn-fantome btn-petit">Ouvrir</Link>
            </div>
          </div>
          <div className="carte">
            <h3>Prochains retraits</h3>
            {(retraits ?? []).length === 0 ? (
              <p className="doux petit" style={{ margin: 0 }}>Aucun retrait prévu.</p>
            ) : (
              <ul className="pile" style={{ padding: 0, margin: 0, gap: 8 }}>
                {(retraits ?? []).map((r) => (
                  <li key={r.id} style={{ listStyle: "none" }}>
                    <Link href={`/espace/commandes/${r.id}`} className="rangee espace-entre" style={{ textDecoration: "none", color: "inherit" }}>
                      <span><strong>{r.prenom}</strong> <span className="doux petit">{r.libelle}</span></span>
                      <span className="badge badge-rose">{r.date_retrait ? formaterDateCourte(r.date_retrait).replace(/ \d{4}$/, "") : ""}{r.heure_retrait ? ` · ${r.heure_retrait}` : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {ab.estPro ? (
            <div className="carte">
              <h3>Statistiques (90 jours)</h3>
              <p className="petit" style={{ margin: "0 0 8px" }}>Devis acceptés : <strong>{taux === null ? "—" : `${taux} %`}</strong> {devisRepondus.length ? <span className="doux">({devisRepondus.length} réponses)</span> : null}</p>
              {[...sources.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <div key={k} className="rangee espace-entre petit"><span>{SOURCES[k] ?? SOURCES.inconnue}</span><strong>{n}</strong></div>
              ))}
            </div>
          ) : (
            <div className="carte">
              <h3>Passer à Pro</h3>
              <p className="doux petit">Demandes illimitées, devis avec acompte, ventes flash payées en ligne et statistiques de provenance.</p>
              <Link href="/espace/abonnement?offre=pro" className="btn btn-primaire btn-petit">Découvrir Pro</Link>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
