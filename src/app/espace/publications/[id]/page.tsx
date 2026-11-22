import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerAtelier } from "@/lib/atelier";
import { abonnementCourant } from "@/lib/acces";
import { UUID_RE, urlPublique } from "@/lib/navigation";
import { env } from "@/lib/env";
import { COLONNES_PUBLICATION, FORMATS, type PublicationPublique } from "@/lib/publications";
import { libelleCreneau } from "@/lib/fuseau";
import { formaterEuros } from "@/lib/argent";
import { IcoFlecheGauche } from "@/components/icones";
import { EditeurPublication } from "./Client";

export const metadata: Metadata = { title: "Publication" };

export default async function PagePublication({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ apres?: string }> }) {
  const { id } = await params;
  const { apres } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, atelier } = await exigerAtelier();
  const { data } = await supabase.from("publications").select(COLONNES_PUBLICATION).eq("id", id).maybeSingle();
  if (!data) notFound();
  const pub = data as PublicationPublique;
  const [{ data: photos }, { data: creneaux }, { data: reservations }, { data: restant }, ab] = await Promise.all([
    supabase.from("publication_photos").select("id, path, path_vignette, position").eq("publication_id", id).order("position"),
    supabase.from("creneaux").select("id, debut, fin, capacite").eq("publication_id", id).order("debut"),
    pub.type === "vente_flash"
      ? supabase.from("reservations").select("id, prenom, quantite, montant_cents, statut, creneau_id, created_at").eq("publication_id", id).in("statut", ["confirmee", "en_attente", "a_rembourser"]).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    supabase.rpc("stock_restant", { p_publication: id }),
    abonnementCourant(),
  ]);

  const lien = `${env.siteUrl}/g/${pub.code}`;
  return (
    <>
      <Link href="/espace/publications" className="rangee petit" style={{ gap: 6, textDecoration: "none", marginBottom: 8 }}>
        <IcoFlecheGauche taille={16} /> Mes publications
      </Link>
      {apres === "pro" && ab.estPro && (
        <div className="alerte alerte-succes" role="status">Offre Pro active : votre brouillon est intact, vous pouvez le publier.</div>
      )}
      <EditeurPublication
        pub={pub}
        atelierId={atelier.id}
        estPro={ab.estPro}
        lien={lien}
        photos={(photos ?? []).map((p) => ({ id: p.id, url: urlPublique(p.path_vignette ?? p.path) ?? "" }))}
        creneaux={(creneaux ?? []).map((c) => ({ id: c.id, libelle: libelleCreneau(c.debut, c.fin, atelier.fuseau), capacite: c.capacite, passe: new Date(c.debut).getTime() < Date.now() }))}
        restant={restant as number | null}
        format={FORMATS[pub.type]}
      />
      {pub.type === "vente_flash" && (reservations ?? []).length > 0 && (
        <section className="carte" style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: "1.2rem" }}>Réservations</h2>
          <ul className="pile" style={{ padding: 0, margin: 0, gap: 8 }}>
            {(reservations ?? []).map((r) => (
              <li key={r.id} className="rangee espace-entre" style={{ listStyle: "none" }}>
                <span>{r.prenom} · {r.quantite} × · {formaterEuros(r.montant_cents)}</span>
                <span className={`badge ${r.statut === "confirmee" ? "badge-vert" : r.statut === "a_rembourser" ? "badge-rose" : "badge-ambre"}`}>
                  {r.statut === "confirmee" ? "Payée" : r.statut === "a_rembourser" ? "À rembourser" : "Paiement en cours"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
