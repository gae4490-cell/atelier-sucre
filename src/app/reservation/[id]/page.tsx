import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { synchroniserSession } from "@/lib/paiements";
import { UUID_RE } from "@/lib/navigation";
import { formaterEuros } from "@/lib/argent";
import { libelleCreneau } from "@/lib/fuseau";
import { IcoCheck, IcoEpingle, IcoHorloge } from "@/components/icones";

export const metadata: Metadata = { title: "Votre réservation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Reservation({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paiement?: string; session?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  if (sp.paiement === "retour" && sp.session) await synchroniserSession(sp.session);
  const admin = createAdminClient();
  const { data: r } = await admin.from("reservations").select("id, statut, quantite, montant_cents, prenom, publication_id, creneau_id, atelier_id").eq("id", id).maybeSingle();
  if (!r) notFound();
  const [{ data: pub }, { data: cr }, { data: a }] = await Promise.all([
    admin.from("publications").select("titre, code").eq("id", r.publication_id).single(),
    admin.from("creneaux").select("debut, fin").eq("id", r.creneau_id).single(),
    admin.from("ateliers").select("nom, zone_retrait, fuseau").eq("id", r.atelier_id).single(),
  ]);
  const quand = cr && a ? libelleCreneau(cr.debut, cr.fin, a.fuseau) : "";

  return (
    <main className="conteneur-etroit" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <section className="carte-arche">
        {r.statut === "confirmee" ? (
          <>
            <span className="rond-icone" style={{ background: "var(--prune)", color: "#fff" }}><IcoCheck taille={44} /></span>
            <h1 style={{ fontSize: "2.1rem" }}>Réservation confirmée</h1>
            <p className="carte-rose serif" style={{ fontSize: "1.8rem", color: "var(--prune-fonce)" }}>{formaterEuros(r.montant_cents)} payés</p>
            <p><strong>{r.quantite} × {pub?.titre}</strong> chez {a?.nom}</p>
            <p className="ligne-icone" style={{ justifyContent: "center" }}><IcoHorloge taille={18} /> {quand}</p>
            {a?.zone_retrait && <p className="ligne-icone" style={{ justifyContent: "center" }}><IcoEpingle taille={18} /> {a.zone_retrait}</p>}
            <p className="doux petit">Un e-mail récapitulatif vous a été envoyé.</p>
          </>
        ) : r.statut === "en_attente" ? (
          <>
            <h1 style={{ fontSize: "1.9rem" }}>Paiement en cours de confirmation…</h1>
            <p className="doux">{sp.paiement === "annule" ? "Paiement annulé : rien n'a été débité. Votre box reste réservée quelques minutes." : "Actualisez la page dans quelques secondes."}</p>
            {pub && <Link href={`/g/${pub.code}`} className="btn btn-fantome">Retour à la vente</Link>}
          </>
        ) : r.statut === "a_rembourser" ? (
          <>
            <h1 style={{ fontSize: "1.9rem" }}>Paiement reçu trop tard</h1>
            <p>La dernière box a été vendue pendant votre paiement. {a?.nom} a été prévenu(e) et va vous rembourser.</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "1.9rem" }}>Réservation non aboutie</h1>
            <p className="doux">Le paiement n&apos;a pas été finalisé : rien n&apos;a été débité et la box a été remise en vente.</p>
            {pub && <Link href={`/g/${pub.code}`} className="btn btn-primaire">Réessayer</Link>}
          </>
        )}
      </section>
    </main>
  );
}
