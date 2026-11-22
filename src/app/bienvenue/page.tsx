import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { atelierCourant, exigerUtilisateur } from "@/lib/atelier";
import { lienVitrine, urlPublique } from "@/lib/navigation";
import { IcoGateau } from "@/components/icones";
import { EtapeApercu, EtapeCreation, EtapeProfil, EtapePublication } from "./Etapes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function PageBienvenue({ searchParams }: { searchParams: Promise<{ etape?: string }> }) {
  const { user } = await exigerUtilisateur();
  const atelier = await atelierCourant();
  const sp = await searchParams;
  const photos = atelier
    ? ((await (await createClient()).from("galerie").select("id, path, titre, prix_indicatif").eq("atelier_id", atelier.id).order("position")).data ?? []).map((p) => ({
        id: p.id as string, url: urlPublique(p.path) ?? "", titre: p.titre as string | null, prix_indicatif: p.prix_indicatif as string | null,
      }))
    : [];

  // 1 Compte (fait) · 2 Atelier · 3 Vitrine · 4 Aperçu · 5 Publication
  const demandee = Number(sp.etape);
  let etape = !atelier ? 2 : [3, 4, 5].includes(demandee) ? demandee : 3;
  if (atelier?.publie && !sp.etape) redirect("/espace");
  if (!atelier) etape = 2;
  if (etape === 5 && !atelier?.publie) etape = 4;

  const etapes = ["Compte", "Atelier", "Vitrine", "Aperçu", "Publication"];

  return (
    <main className="page-auth">
      <div className="conteneur-etroit" style={{ paddingTop: 24, paddingBottom: 60 }}>
        <div className="rangee espace-entre" style={{ marginBottom: 18 }}>
          <span className="logo-marque">
            <IcoGateau taille={30} /> Atelier Sucré
          </span>
          <form action="/auth/deconnexion" method="post">
            <button className="btn btn-fantome btn-petit">Se déconnecter</button>
          </form>
        </div>

        <ol className="etapes" aria-label="Progression">
          {etapes.map((libelle, i) => {
            const n = i + 1;
            const cls = n < etape || (n === 5 && atelier?.publie) ? "etape faite" : n === etape ? "etape active" : "etape";
            return (
              <li key={libelle} className={cls} aria-current={n === etape ? "step" : undefined} style={{ listStyle: "none" }}>
                <span className="pastille">{n < etape || (n === 5 && atelier?.publie) ? "✓" : n}</span>
                {libelle}
              </li>
            );
          })}
        </ol>

        {etape === 2 && <EtapeCreation emailParDefaut={user.email ?? ""} />}
        {etape === 3 && atelier && (
          <EtapeProfil
            atelierId={atelier.id}
            logoUrl={urlPublique(atelier.logo_path)}
            photos={photos}
            valeurs={{
              accroche: atelier.accroche ?? "",
              description: atelier.description ?? "",
              zone_retrait: atelier.zone_retrait ?? "",
              instagram: atelier.instagram ?? "",
              ville: atelier.ville ?? "",
              retrait_actif: atelier.retrait_actif,
              livraison_active: atelier.livraison_active,
              delai_min_jours: atelier.delai_min_jours,
            }}
          />
        )}
        {etape === 4 && atelier && <EtapeApercu chemin={`/p/${atelier.slug}`} />}
        {(etape === 4 || etape === 5) && atelier && (
          <EtapePublication lien={lienVitrine(atelier.slug)} dejaPublie={atelier.publie} />
        )}

        {atelier && (
          <p className="centre petit" style={{ marginTop: 26 }}>
            <Link href="/espace">Passer et aller à mon espace</Link>
          </p>
        )}
      </div>
    </main>
  );
}
