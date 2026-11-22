import type { Metadata } from "next";
import Link from "next/link";
import { exigerAtelier } from "@/lib/atelier";
import { abonnementCourant } from "@/lib/acces";
import { DEVIS, type StatutDevis } from "@/lib/statuts";
import { formaterEuros } from "@/lib/argent";
import { formaterDateCourte } from "@/lib/validation";
import { IcoDocument } from "@/components/icones";
import { BandeauPro } from "@/components/BandeauPro";

export const metadata: Metadata = { title: "Devis" };

export default async function ListeDevis() {
  const { supabase, atelier } = await exigerAtelier();
  const ab = await abonnementCourant();
  const { data } = await supabase
    .from("devis")
    .select("id, statut, total_cents, acompte_cents, valide_jusqu, created_at, demandes(prenom, theme)")
    .eq("atelier_id", atelier.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const liste = (data ?? []) as unknown as {
    id: string; statut: StatutDevis; total_cents: number; acompte_cents: number; valide_jusqu: string | null; created_at: string;
    demandes: { prenom: string; theme: string | null } | null;
  }[];

  return (
    <>
      <h1 className="titre-page">Devis</h1>
      {!ab.estPro && <BandeauPro texte="Envoyez des devis avec acompte en ligne et suivez les soldes avec l'offre Pro." />}
      {liste.length === 0 ? (
        <div className="etat-vide">
          <IcoDocument taille={36} />
          <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Aucun devis pour l&apos;instant</p>
          <p className="doux petit">Ouvrez une demande puis « Créer un devis ».</p>
          <Link href="/espace/demandes" className="btn btn-fantome">Voir mes demandes</Link>
        </div>
      ) : (
        <div className="carte" style={{ padding: 0, overflow: "hidden" }}>
          {liste.map((d) => (
            <Link key={d.id} href={`/espace/devis/${d.id}`} className="notif" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="contenu">
                <strong>{d.demandes?.prenom ?? "Client"}</strong>
                <span className="doux"> · {d.demandes?.theme ?? "Gâteau sur mesure"}</span>
                <div className="petit doux">
                  {formaterEuros(d.total_cents)}{d.acompte_cents ? ` · acompte ${formaterEuros(d.acompte_cents)}` : ""}
                  {d.valide_jusqu ? ` · valable jusqu'au ${formaterDateCourte(d.valide_jusqu)}` : ""}
                </div>
              </div>
              <span className={`badge badge-${DEVIS[d.statut].ton}`}>{DEVIS[d.statut].l}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
