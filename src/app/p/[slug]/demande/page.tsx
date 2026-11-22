import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { chargerVitrine } from "../donnees";
import { createAdminClient } from "@/lib/supabase/admin";
import { aujourdhuiA } from "@/lib/validation";
import { FormulaireDemande } from "./FormulaireDemande";
import { createClient } from "@/lib/supabase/server";
import { sourceDepuis } from "@/lib/publications";
import { urlPublique } from "@/lib/navigation";
import { formaterEuros } from "@/lib/argent";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ pub?: string; src?: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const v = await chargerVitrine(slug);
  return { title: v ? `Demander un devis — ${v.atelier.nom}` : "Demande de devis", robots: { index: false } };
}

export default async function PageDemande({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const v = await chargerVitrine(slug);
  if (!v) notFound();
  const { atelier } = v;
  const aujourdhui = aujourdhuiA();

  // Les dates bloquées ne sont pas lisibles publiquement (motifs privés) :
  // le serveur n'expose que les jours.
  const { data: dates } = await createAdminClient()
    .from("dates_bloquees")
    .select("jour")
    .eq("atelier_id", atelier.id)
    .gte("jour", aujourdhui)
    .order("jour")
    .limit(400);

  let gateau: { code: string; titre: string; prix: string | null; photo: string | null } | null = null;
  if (sp.pub && /^[a-f0-9]{10}$/.test(sp.pub)) {
    const supabase = await createClient();
    const { data: p } = await supabase
      .from("publications")
      .select("code, titre, prix_cents, atelier_id, type, publication_photos(path_vignette, path, position)")
      .eq("code", sp.pub)
      .maybeSingle();
    if (p && p.atelier_id === atelier.id && p.type !== "vente_flash") {
      const ph = [...((p.publication_photos as { path_vignette: string | null; path: string; position: number }[]) ?? [])].sort((a, b) => a.position - b.position)[0];
      gateau = { code: p.code, titre: p.titre, prix: p.prix_cents != null ? formaterEuros(p.prix_cents) : null, photo: ph ? urlPublique(ph.path_vignette ?? ph.path) : null };
    }
  }

  return (
    <FormulaireDemande
      gateau={gateau}
      source={sourceDepuis(sp.src)}
      slug={atelier.slug}
      nomAtelier={atelier.nom}
      apercu={v.apercu}
      options={{
        typesEvenement: atelier.types_evenement,
        parfums: atelier.parfums,
        retraitActif: atelier.retrait_actif,
        livraisonActive: atelier.livraison_active,
        zoneRetrait: atelier.zone_retrait,
        livraisonNote: atelier.livraison_note,
      }}
      ctx={{
        aujourdhui,
        delaiMinJours: atelier.delai_min_jours,
        datesBloquees: (dates ?? []).map((d) => d.jour as string),
        retraitActif: atelier.retrait_actif,
        livraisonActive: atelier.livraison_active,
      }}
    />
  );
}
