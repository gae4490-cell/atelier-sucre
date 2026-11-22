import type { Metadata } from "next";
import Link from "next/link";
import { exigerAtelier } from "@/lib/atelier";
import { aujourdhuiA } from "@/lib/validation";
import type { StatutDemande } from "@/lib/statuts";
import { IcoCalendrier, IcoChevronDroit, IcoFlecheGauche, IcoGateau } from "@/components/icones";

export const metadata: Metadata = { title: "Calendrier" };

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function decaler(mois: string, n: number) {
  const [a, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export default async function Calendrier({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const { supabase, atelier } = await exigerAtelier();
  const aujourdhui = aujourdhuiA();
  const sp = await searchParams;
  const mois = sp.mois && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mois) ? sp.mois : aujourdhui.slice(0, 7);
  const [annee, m] = mois.split("-").map(Number);
  const premier = new Date(Date.UTC(annee, m - 1, 1));
  const nbJours = new Date(Date.UTC(annee, m, 0)).getUTCDate();
  const decalage = (premier.getUTCDay() + 6) % 7; // lundi = 0
  const debut = `${mois}-01`;
  const fin = `${mois}-${String(nbJours).padStart(2, "0")}`;

  const [{ data: demandes }, { data: bloquees }, { data: commandes }] = await Promise.all([
    supabase
      .from("demandes")
      .select("id, prenom, theme, date_souhaitee, statut")
      .eq("atelier_id", atelier.id)
      .gte("date_souhaitee", debut)
      .lte("date_souhaitee", fin)
      .in("statut", ["nouvelle", "devis_envoye", "acompte_en_attente"])
      .order("date_souhaitee"),
    supabase.from("dates_bloquees").select("jour, motif").eq("atelier_id", atelier.id).gte("jour", debut).lte("jour", fin),
    supabase
      .from("commandes")
      .select("id, prenom, libelle, date_retrait, heure_retrait, statut")
      .eq("atelier_id", atelier.id)
      .gte("date_retrait", debut)
      .lte("date_retrait", fin)
      .neq("statut", "annulee")
      .order("heure_retrait"),
  ]);
  const cmdParJour = new Map<string, { id: string; prenom: string; libelle: string; heure_retrait: string | null }[]>();
  for (const c of commandes ?? []) {
    const l = cmdParJour.get(c.date_retrait) ?? [];
    l.push(c as never);
    cmdParJour.set(c.date_retrait, l);
  }

  const parJour = new Map<string, { id: string; prenom: string; theme: string | null; statut: StatutDemande }[]>();
  for (const d of demandes ?? []) {
    const l = parJour.get(d.date_souhaitee) ?? [];
    l.push(d as never);
    parJour.set(d.date_souhaitee, l);
  }
  const jourBloque = new Map((bloquees ?? []).map((b) => [b.jour as string, b.motif as string | null]));
  const cases: (number | null)[] = [...Array(decalage).fill(null), ...Array.from({ length: nbJours }, (_, i) => i + 1)];
  while (cases.length % 7) cases.push(null);

  const confirmees: StatutDemande[] = ["confirmee", "en_preparation", "prete", "remise"];

  return (
    <>
      <h1 className="titre-page"><IcoCalendrier taille={30} /> Calendrier des commandes</h1>
      <div className="rangee" style={{ justifyContent: "center", margin: "6px 0 16px" }}>
        <Link href={`/espace/calendrier?mois=${decaler(mois, -1)}`} className="btn btn-icone btn-fantome" aria-label="Mois précédent"><IcoFlecheGauche /></Link>
        <strong className="serif" style={{ fontSize: "1.3rem", minWidth: 170, textAlign: "center" }}>{MOIS[m - 1]} {annee}</strong>
        <Link href={`/espace/calendrier?mois=${decaler(mois, 1)}`} className="btn btn-icone btn-fantome" aria-label="Mois suivant"><IcoChevronDroit /></Link>
      </div>

      <div className="calendrier" role="grid" aria-label={`${MOIS[m - 1]} ${annee}`}>
        {JOURS.map((j) => <div key={j} className="cal-entete" role="columnheader">{j}</div>)}
        {cases.map((n, i) => {
          if (!n) return <div key={`v${i}`} className="cal-case vide" />;
          const iso = `${mois}-${String(n).padStart(2, "0")}`;
          const items = parJour.get(iso) ?? [];
          const bloque = jourBloque.has(iso);
          return (
            <div key={iso} className={`cal-case ${bloque ? "bloque" : ""} ${iso === aujourdhui ? "aujourdhui" : ""}`} role="gridcell">
              <span className="cal-num">{n}</span>
              {bloque && <span className="cal-bloque">Indisponible</span>}
              {(cmdParJour.get(iso) ?? []).map((c) => (
                <Link key={c.id} href={`/espace/commandes/${c.id}`} className="cal-item confirme" title={`${c.libelle} — ${c.prenom}`}>
                  <IcoGateau taille={13} /> {c.heure_retrait ? `${c.heure_retrait.split(" ")[0]} ` : ""}{c.prenom}
                </Link>
              ))}
              {items.map((d) => (
                <Link key={d.id} href={`/espace/demandes/${d.id}`} className={`cal-item ${confirmees.includes(d.statut) ? "confirme" : ""}`}>
                  <IcoGateau taille={13} /> {d.theme ?? d.prenom}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
      <p className="doux petit rangee" style={{ marginTop: 12, gap: 16 }}>
        <span><span className="cal-legende" style={{ background: "var(--rose)" }} /> Demande en cours</span>
        <span><span className="cal-legende" style={{ background: "#e3dcf0" }} /> Commande confirmée</span>
        <span><span className="cal-legende" style={{ background: "var(--creme-3)" }} /> Indisponible</span>
      </p>
      <p className="doux petit"><Link href="/espace/vitrine">Gérer les dates bloquées</Link></p>
    </>
  );
}
