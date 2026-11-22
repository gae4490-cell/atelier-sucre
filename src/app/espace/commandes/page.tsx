import type { Metadata } from "next";
import Link from "next/link";
import { exigerAtelier } from "@/lib/atelier";
import { aujourdhuiA, formaterDateCourte } from "@/lib/validation";
import { formaterEuros } from "@/lib/argent";
import { IcoSac } from "@/components/icones";
import { BadgesCommande, type CommandeSuivi } from "./composants";

export const metadata: Metadata = { title: "Commandes" };

export default async function Commandes({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { supabase, atelier } = await exigerAtelier();
  const { vue = "a-venir" } = await searchParams;
  const aujourdhui = aujourdhuiA(atelier.fuseau ?? "Europe/Paris");
  let req = supabase.from("commandes_suivi").select("*").eq("atelier_id", atelier.id);
  if (vue === "a-venir") req = req.neq("statut", "remise").neq("statut", "annulee").order("date_retrait", { ascending: true });
  else if (vue === "solde") req = req.gt("reste_cents", 0).neq("statut", "annulee").order("date_retrait", { ascending: true });
  else req = req.order("date_retrait", { ascending: false });
  const { data } = await req.limit(200);
  const liste = (data ?? []) as CommandeSuivi[];
  const onglets = [
    ["a-venir", "À venir"],
    ["solde", "Soldes à encaisser"],
    ["toutes", "Toutes"],
  ];

  return (
    <>
      <h1 className="titre-page">Commandes</h1>
      <nav className="onglets">
        {onglets.map(([v, l]) => (
          <Link key={v} href={`/espace/commandes?vue=${v}`} className="onglet" aria-current={vue === v ? "true" : undefined}>{l}</Link>
        ))}
      </nav>
      {liste.length === 0 ? (
        <div className="etat-vide">
          <IcoSac taille={36} />
          <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Aucune commande ici</p>
          <p className="doux petit">Une commande apparaît quand un devis est accepté (et l&apos;acompte payé) ou qu&apos;une vente flash est réservée.</p>
        </div>
      ) : (
        <div className="carte" style={{ padding: 0, overflow: "hidden" }}>
          {liste.map((c) => (
            <Link key={c.id} href={`/espace/commandes/${c.id}`} className="notif" style={{ textDecoration: "none", color: "inherit", flexWrap: "wrap" }}>
              <div className="contenu">
                <strong>#{c.numero} · {c.prenom}</strong> <span className="doux">{c.libelle}</span>
                <div className="petit doux">
                  {c.date_retrait ? `${c.date_retrait < aujourdhui ? "Passée — " : ""}${formaterDateCourte(c.date_retrait)}` : "Date à fixer"}
                  {c.heure_retrait ? `, ${c.heure_retrait}` : ""} · {formaterEuros(c.paye_cents)} reçus · {formaterEuros(c.reste_cents)} restants
                </div>
              </div>
              <BadgesCommande c={c} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
