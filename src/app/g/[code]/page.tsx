import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { urlPublique } from "@/lib/navigation";
import { COLONNES_PUBLICATION, FORMATS, sourceDepuis, type PublicationPublique } from "@/lib/publications";
import { formaterEuros } from "@/lib/argent";
import { libelleCreneau } from "@/lib/fuseau";
import { modePaiement } from "@/lib/stripe";
import { env } from "@/lib/env";
import { BoutonCopier } from "@/components/ui";
import { IcoBulle, IcoEpingle, IcoFlecheDroite, IcoGateau } from "@/components/icones";
import { FormulaireReservation } from "./Reservation";

const charger = cache(async (code: string) => {
  if (!/^[a-f0-9]{10}$/.test(code)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("publications").select(COLONNES_PUBLICATION).eq("code", code).maybeSingle();
  if (!data) return null;
  const pub = data as PublicationPublique;
  const [{ data: atelier }, { data: photos }, { data: creneaux }, { data: restant }, { data: pro }] = await Promise.all([
    supabase.from("ateliers").select("nom, slug, ville, zone_retrait, logo_path, fuseau, publie").eq("id", pub.atelier_id).single(),
    supabase.from("publication_photos").select("path, path_vignette").eq("publication_id", pub.id).order("position"),
    supabase.from("creneaux").select("id, debut, fin, capacite").eq("publication_id", pub.id).gt("debut", new Date().toISOString()).order("debut"),
    supabase.rpc("stock_restant", { p_publication: pub.id }),
    supabase.rpc("est_pro", { p_atelier: pub.atelier_id }),
  ]);
  const places = await Promise.all((creneaux ?? []).map(async (c) => (c.capacite ? (await supabase.rpc("places_creneau", { p_creneau: c.id })).data : null)));
  return { pub, atelier, photos: photos ?? [], creneaux: (creneaux ?? []).map((c, i) => ({ ...c, places: places[i] as number | null })), restant: restant as number | null, pro: !!pro };
});

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ src?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const v = await charger(code);
  if (!v) return { title: "Gâteau introuvable" };
  const img = urlPublique(v.photos[0]?.path);
  return {
    title: `${v.pub.titre} — ${v.atelier?.nom}`,
    description: v.pub.description?.slice(0, 160) ?? `${FORMATS[v.pub.type].nom} par ${v.atelier?.nom}`,
    openGraph: img ? { images: [img] } : undefined,
    robots: v.pub.statut !== "publiee" ? { index: false } : undefined,
  };
}

export default async function FicheGateau({ params, searchParams }: Props) {
  const { code } = await params;
  const { src } = await searchParams;
  const v = await charger(code);
  if (!v || !v.atelier) notFound();
  const { pub, atelier, photos, creneaux, restant, pro } = v;
  const source = sourceDepuis(src) === "inconnue" ? "lien_partage" : sourceDepuis(src);
  const apercu = pub.statut === "brouillon";
  const termine = pub.statut === "archivee" || (pub.type === "vente_flash" && creneaux.length === 0);
  const epuise = pub.type === "vente_flash" && restant === 0;
  const lienDemande = `/p/${atelier.slug}/demande?pub=${pub.code}&src=${source}`;

  return (
    <>
      {apercu && <div className="bandeau-apercu">Aperçu : cette publication n&apos;est pas encore en ligne.</div>}
      <main className="conteneur-etroit" style={{ maxWidth: 640, paddingBottom: 40 }}>
        <header className="rangee espace-entre" style={{ padding: "14px 0" }}>
          <Link href={`/p/${atelier.slug}`} className="rangee" style={{ textDecoration: "none", color: "var(--prune-fonce)", gap: 10 }}>
            <span className="avatar" style={{ background: "var(--rose)", color: "var(--prune)" }}>
              {atelier.logo_path ? <img src={urlPublique(atelier.logo_path) ?? ""} alt="" /> : <IcoGateau />}
            </span>
            <span>
              <strong className="serif" style={{ fontSize: "1.15rem", display: "block" }}>{atelier.nom}</strong>
              {atelier.ville && <span className="petit doux rangee" style={{ gap: 4 }}><IcoEpingle taille={14} /> {atelier.ville}</span>}
            </span>
          </Link>
          <Link href="/decouvrir" className="petit">Découvrir</Link>
        </header>

        <div className="defilement-photos" aria-label="Photos">
          {photos.length === 0 ? <div className="photo photo-carre"><IcoGateau taille={48} /></div> : photos.map((p, i) => (
            <div key={i} className="photo photo-carre"><img src={urlPublique(p.path) ?? ""} alt={i === 0 ? pub.titre : ""} loading={i === 0 ? "eager" : "lazy"} /></div>
          ))}
        </div>

        <div className="rangee espace-entre" style={{ marginTop: 16 }}>
          <span className="badge badge-rose">{FORMATS[pub.type].nom}</span>
          {pub.categorie && <span className="petit doux">{pub.categorie}</span>}
        </div>
        <h1 style={{ marginTop: 10 }}>{pub.titre}</h1>
        {pub.prix_cents != null && (
          <p className="serif" style={{ fontSize: "1.6rem", color: "var(--prune)", margin: "-6px 0 10px" }}>
            {pub.type === "vente_flash" ? formaterEuros(pub.prix_cents) : `à partir de ${formaterEuros(pub.prix_cents)}`}
          </p>
        )}
        {pub.description && <p style={{ whiteSpace: "pre-line" }}>{pub.description}</p>}
        {pub.disponibilite && <p className="ligne-icone"><IcoEpingle taille={18} /> {pub.disponibilite}</p>}
        {atelier.zone_retrait && <p className="doux petit">Retrait : {atelier.zone_retrait}</p>}

        {pub.type === "vente_flash" ? (
          termine ? (
            <div className="alerte alerte-info" role="status">Vente terminée. <Link href={`/p/${atelier.slug}`}>Voir les autres créations</Link></div>
          ) : epuise ? (
            <div className="alerte alerte-ambre" role="status">Épuisée : toutes les box ont trouvé preneur.</div>
          ) : !pro ? (
            <div className="alerte alerte-info" role="status">Les réservations sont momentanément fermées pour cette vente.</div>
          ) : (
            <>
              <p className="badge badge-vert" style={{ fontSize: "0.95rem", padding: "6px 14px" }}>{restant} disponible{(restant ?? 0) > 1 ? "s" : ""} sur {pub.stock_total}</p>
              {modePaiement() === "simulation" && <p className="bandeau-apercu" style={{ borderRadius: 12 }}>Mode test : paiement simulé, aucune carte débitée.</p>}
              {modePaiement() === "stripe" && !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live") && <p className="petit doux">Paiement sécurisé par Stripe (mode test pendant le pilote).</p>}
              <FormulaireReservation
                publicationId={pub.id}
                code={pub.code}
                source={source}
                prixCents={pub.prix_cents ?? 0}
                max={Math.min(pub.max_par_client, restant ?? 1)}
                creneaux={creneaux.map((c) => ({ id: c.id, libelle: libelleCreneau(c.debut, c.fin, atelier.fuseau), places: c.places }))}
                apercu={apercu}
              />
            </>
          )
        ) : (
          <Link href={lienDemande} className="btn btn-primaire btn-large" aria-disabled={apercu}>
            <IcoBulle /> {FORMATS[pub.type].bouton} <IcoFlecheDroite />
          </Link>
        )}

        <div className="rangee" style={{ marginTop: 18, justifyContent: "center" }}>
          <BoutonCopier texte={`${env.siteUrl}/g/${pub.code}`} libelle="Copier le lien" className="btn btn-fantome btn-petit" />
        </div>
      </main>
    </>
  );
}
