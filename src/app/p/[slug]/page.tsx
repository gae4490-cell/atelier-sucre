import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { chargerVitrine, nouveauSlug } from "./donnees";
import { sourceDepuis, FORMATS } from "@/lib/publications";
import { formaterEuros } from "@/lib/argent";
import { urlPublique } from "@/lib/navigation";
import { IcoBulle, IcoEpingle, IcoFlecheDroite, IcoGateau, IcoHorloge, IcoInstagram } from "@/components/icones";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ src?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const v = await chargerVitrine(slug);
  if (!v) return { title: "Vitrine introuvable" };
  const image = urlPublique(v.atelier.couverture_path ?? v.atelier.logo_path);
  return {
    title: v.atelier.nom,
    description: v.atelier.accroche ?? `Demandez un devis pour votre gâteau sur mesure à ${v.atelier.nom}.`,
    openGraph: image ? { images: [image] } : undefined,
    robots: v.apercu ? { index: false } : undefined,
  };
}

export default async function PageVitrine({ params, searchParams }: Props) {
  const { slug } = await params;
  const { src } = await searchParams;
  const v = await chargerVitrine(slug);
  if (!v) {
    const nouveau = await nouveauSlug(slug);
    if (nouveau) permanentRedirect(`/p/${nouveau}${src ? `?src=${encodeURIComponent(src)}` : ""}`);
    notFound();
  }
  const { atelier, galerie, publications, apercu } = v;
  const source = sourceDepuis(src);
  const suffixe = source !== "inconnue" ? `?src=${source}` : "";
  const logo = urlPublique(atelier.logo_path);
  const couverture = urlPublique(atelier.couverture_path) ?? (galerie[0] ? urlPublique(galerie[0].path) : null);

  return (
    <>
      {apercu && (
        <div className="bandeau-apercu" role="status">
          Aperçu : votre vitrine n&apos;est pas encore publiée. <Link href="/espace/vitrine">Publier</Link>
        </div>
      )}
      <main className="conteneur-etroit" style={{ maxWidth: 640 }}>
        <header className="vitrine-entete">
          <span style={{ width: 44 }} />
          <span />
          {atelier.instagram ? (
            <a href={`https://instagram.com/${atelier.instagram}`} className="btn btn-icone" style={{ color: "var(--prune)" }} aria-label={`Instagram de ${atelier.nom}`} rel="noopener">
              <IcoInstagram taille={26} />
            </a>
          ) : (
            <span style={{ width: 44 }} />
          )}
        </header>

        <div className="vitrine-marque">
          <div className="logo">{logo ? <img src={logo} alt={`Logo ${atelier.nom}`} /> : <IcoGateau taille={40} />}</div>
          <h1 className="nom" style={{ margin: "6px 0 0", fontSize: "2.1rem" }}>{atelier.nom}</h1>
          <span className="surtitre">Gâteaux sur mesure{atelier.ville ? ` · ${atelier.ville}` : ""}</span>
        </div>

        <section className={`vitrine-hero ${couverture ? "avec-image" : ""}`}>
          {couverture && <img src={couverture} alt="" />}
          <p className="accroche">{atelier.accroche ?? "Vos gâteaux uniques, à votre image"}</p>
        </section>

        <div style={{ margin: "18px 0 6px" }}>
          <Link href={`/p/${atelier.slug}/demande${suffixe}`} className="btn btn-primaire btn-large">
            <IcoBulle /> Demander un devis <IcoFlecheDroite />
          </Link>
        </div>

        {publications.length > 0 && (
          <section aria-labelledby="gateaux">
            <div className="titre-section"><h2 id="gateaux">Nos gâteaux</h2></div>
            <div className="galerie">
              {publications.map((p) => (
                <Link key={p.id} href={`/g/${p.code}${source !== "inconnue" ? `?src=${source}` : "?src=vitrine"}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <figure>
                    <div className="photo photo-carre" style={{ position: "relative" }}>
                      {p.photo ? <img src={urlPublique(p.photo.path_vignette ?? p.photo.path) ?? ""} alt={p.titre} loading="lazy" /> : <IcoGateau taille={32} />}
                      {p.type === "vente_flash" && <span className="badge badge-vert etiquette-fil">Vente flash</span>}
                    </div>
                    <figcaption>
                      <span>{p.titre}</span>
                      {p.prix_cents != null && <strong style={{ color: "var(--prune)" }}>{p.type === "vente_flash" ? "" : "dès "}{formaterEuros(p.prix_cents)}</strong>}
                    </figcaption>
                    <span className="petit doux">{FORMATS[p.type].nom}</span>
                  </figure>
                </Link>
              ))}
            </div>
          </section>
        )}

        {galerie.length > 0 && (
          <section aria-labelledby="creations">
            <div className="titre-section">
              <h2 id="creations">{publications.length ? "Galerie" : "Nos créations"}</h2>
            </div>
            <div className="galerie">
              {galerie.map((p) => (
                <figure key={p.id}>
                  <div className="photo photo-carre">
                    <img src={urlPublique(p.path) ?? ""} alt={p.titre ?? `Création de ${atelier.nom}`} loading="lazy" />
                  </div>
                  {(p.titre || (atelier.afficher_tarifs && p.prix_indicatif)) && (
                    <figcaption>
                      <span>{p.titre}</span>
                      {atelier.afficher_tarifs && p.prix_indicatif && <strong style={{ color: "var(--prune)" }}>{p.prix_indicatif}</strong>}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {atelier.description && (
          <section aria-labelledby="apropos">
            <div className="titre-section">
              <h2 id="apropos">L&apos;atelier</h2>
            </div>
            <p style={{ whiteSpace: "pre-line" }}>{atelier.description}</p>
          </section>
        )}

        <section className="carte-plate pile" style={{ marginTop: 22 }} aria-label="Retrait et livraison">
          {atelier.retrait_actif && (
            <div className="ligne-icone" style={{ alignItems: "flex-start" }}>
              <IcoEpingle />
              <div>
                <strong>Retrait</strong>
                {atelier.zone_retrait && <div>{atelier.zone_retrait}</div>}
              </div>
            </div>
          )}
          {atelier.horaires_retrait && (
            <div className="ligne-icone" style={{ alignItems: "flex-start" }}>
              <IcoHorloge />
              <div style={{ whiteSpace: "pre-line" }}>{atelier.horaires_retrait}</div>
            </div>
          )}
          {atelier.livraison_active && (
            <div className="ligne-icone" style={{ alignItems: "flex-start" }}>
              <IcoGateau />
              <div>
                <strong>Livraison possible</strong>
                {atelier.livraison_note && <div>{atelier.livraison_note}</div>}
              </div>
            </div>
          )}
          <p className="doux petit" style={{ margin: 0 }}>
            Commandez au moins {atelier.delai_min_jours} jour{atelier.delai_min_jours > 1 ? "s" : ""} à l&apos;avance.
          </p>
        </section>

        {atelier.afficher_tarifs && atelier.tarifs_note && (
          <section aria-labelledby="tarifs">
            <div className="titre-section">
              <h2 id="tarifs">Tarifs indicatifs</h2>
            </div>
            <p style={{ whiteSpace: "pre-line" }}>{atelier.tarifs_note}</p>
          </section>
        )}

        <div className="cta-collant">
          <Link href={`/p/${atelier.slug}/demande${suffixe}`} className="btn btn-primaire btn-large">
            <IcoBulle /> Demander un devis <IcoFlecheDroite />
          </Link>
        </div>
        <p className="pied">Commandes gérées avec Atelier Sucré</p>
      </main>
    </>
  );
}
