import type { Metadata } from "next";
import Link from "next/link";
import { exigerAtelier } from "@/lib/atelier";
import { lienVitrine, urlPublique } from "@/lib/navigation";
import { aujourdhuiA } from "@/lib/validation";
import type { PhotoGalerie } from "@/lib/types";
import { BoutonCopier } from "@/components/ui";
import { ChoixPhoto } from "@/app/bienvenue/Etapes";
import { DatesBloquees, FormFormulaire, FormIdentite, FormRetrait, Galerie, InterrupteurPublication } from "./Formulaires";

export const metadata: Metadata = { title: "Ma vitrine" };

export default async function PageVitrine() {
  const { supabase, atelier } = await exigerAtelier();
  const [{ data: galerie }, { data: dates }] = await Promise.all([
    supabase.from("galerie").select("id, atelier_id, path, titre, prix_indicatif, position").eq("atelier_id", atelier.id).order("position").order("created_at"),
    supabase.from("dates_bloquees").select("jour, motif").eq("atelier_id", atelier.id).gte("jour", aujourdhuiA()).order("jour"),
  ]);
  const lien = lienVitrine(atelier.slug);
  const photos = ((galerie ?? []) as PhotoGalerie[]).map((p) => ({ ...p, url: urlPublique(p.path) ?? "" }));

  return (
    <>
      <div className="rangee espace-entre" style={{ marginBottom: 16 }}>
        <h1 className="titre-page">Ma vitrine</h1>
        <Link href={`/p/${atelier.slug}`} target="_blank" className="btn btn-fantome btn-petit">Prévisualiser</Link>
      </div>

      <section className="carte" style={{ marginBottom: 18 }}>
        <InterrupteurPublication publie={atelier.publie} />
        <p className="petit doux" style={{ margin: "10px 0 4px" }}>Lien à mettre dans votre bio Instagram</p>
        <p style={{ fontWeight: 600, overflowWrap: "anywhere", margin: "0 0 10px" }}>{lien}</p>
        <BoutonCopier texte={`${lien}?src=instagram`} libelle="Copier mon lien Instagram" className="btn btn-secondaire btn-petit" />
        <p className="aide">Le lien copié est marqué « Instagram » : les demandes qui en viennent sont identifiées dans vos statistiques.</p>
      </section>

      <div className="grille-2" style={{ alignItems: "start" }}>
        <div className="pile">
          <section className="carte">
            <h2 style={{ fontSize: "1.3rem" }}>Identité</h2>
            <div className="rangee" style={{ gap: 24, alignItems: "flex-start" }}>
              <ChoixPhoto atelierId={atelier.id} champ="logo_path" urlInitiale={urlPublique(atelier.logo_path)} libelle="Logo" rond />
              <ChoixPhoto atelierId={atelier.id} champ="couverture_path" urlInitiale={urlPublique(atelier.couverture_path)} libelle="Photo de couverture" />
            </div>
            <FormIdentite
              valeurs={{
                nom: atelier.nom,
                slug: atelier.slug,
                accroche: atelier.accroche ?? "",
                description: atelier.description ?? "",
                instagram: atelier.instagram ?? "",
                ville: atelier.ville ?? "",
                contact_public: atelier.contact_public ?? "",
              }}
            />
          </section>

          <section className="carte">
            <h2 style={{ fontSize: "1.3rem" }}>Galerie et créations</h2>
            <Galerie atelierId={atelier.id} photos={photos} />
          </section>
        </div>

        <div className="pile">
          <section className="carte">
            <h2 style={{ fontSize: "1.3rem" }}>Retrait, livraison et horaires</h2>
            <FormRetrait
              valeurs={{
                retrait_actif: atelier.retrait_actif,
                livraison_active: atelier.livraison_active,
                zone_retrait: atelier.zone_retrait ?? "",
                horaires_retrait: atelier.horaires_retrait ?? "",
                livraison_note: atelier.livraison_note ?? "",
                delai_min_jours: atelier.delai_min_jours,
              }}
            />
          </section>

          <section className="carte">
            <h2 style={{ fontSize: "1.3rem" }}>Dates indisponibles</h2>
            <p className="doux petit">Ces jours ne pourront pas être choisis sur le formulaire.</p>
            <DatesBloquees dates={(dates ?? []) as { jour: string; motif: string | null }[]} />
          </section>

          <section className="carte">
            <h2 style={{ fontSize: "1.3rem" }}>Options du formulaire et tarifs</h2>
            <FormFormulaire
              valeurs={{
                types_evenement: atelier.types_evenement.join("\n"),
                parfums: atelier.parfums.join("\n"),
                afficher_tarifs: atelier.afficher_tarifs,
                tarifs_note: atelier.tarifs_note ?? "",
              }}
            />
          </section>
        </div>
      </div>
    </>
  );
}
