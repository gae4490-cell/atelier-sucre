import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerVitrine } from "../../donnees";
import { IcoEnvoi, IcoHorloge, IcoInstagram, IcoToque } from "@/components/icones";

export const metadata: Metadata = { title: "Demande envoyée", robots: { index: false } };

export default async function PageEnvoyee({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ n?: string }>;
}) {
  const { slug } = await params;
  const { n } = await searchParams;
  const v = await chargerVitrine(slug);
  if (!v) notFound();
  const { atelier } = v;
  const numero = n && /^\d{1,10}$/.test(n) ? n : null;

  return (
    <main className="conteneur-etroit" style={{ padding: "40px 20px" }}>
      <section className="carte-arche">
        <div className="rond-icone">
          <IcoEnvoi taille={42} />
        </div>
        <h1 style={{ fontSize: "2.1rem", marginBottom: 14 }}>Demande envoyée&nbsp;!</h1>
        <p className="badge badge-rose" style={{ fontSize: "1rem", padding: "8px 18px", gap: 8 }}>
          <IcoHorloge /> En attente du pâtissier
        </p>

        <ol className="etapes" style={{ padding: 0, marginTop: 22 }} aria-label="Suivi">
          <li className="etape active" style={{ listStyle: "none" }}><span className="pastille" style={{ width: 22, height: 22 }} />Demande envoyée</li>
          <li className="etape" style={{ listStyle: "none" }}><span className="pastille" style={{ width: 22, height: 22 }} />Devis proposé</li>
          <li className="etape" style={{ listStyle: "none" }}><span className="pastille" style={{ width: 22, height: 22 }} />Confirmation</li>
        </ol>

        <hr style={{ border: 0, borderTop: "1px solid var(--rose-2)", margin: "18px 0" }} />
        <IcoToque taille={34} style={{ color: "var(--prune)", margin: "0 auto 8px" }} />
        <p role="status" style={{ fontWeight: 600, fontSize: "1.05rem" }}>
          Demande envoyée. Le pâtissier doit encore confirmer votre commande.
        </p>
        <p className="doux">
          {atelier.nom} étudie votre projet{numero ? ` (demande n° ${numero})` : ""} et vous enverra un devis bientôt. Un récapitulatif vous a été envoyé par e-mail.
        </p>

        {atelier.instagram ? (
          <a href={`https://instagram.com/${atelier.instagram}`} className="btn btn-primaire btn-large" rel="noopener">
            <IcoInstagram /> Revenir sur Instagram
          </a>
        ) : (
          <Link href={`/p/${atelier.slug}`} className="btn btn-primaire btn-large">
            Revenir à la vitrine
          </Link>
        )}
      </section>
    </main>
  );
}
