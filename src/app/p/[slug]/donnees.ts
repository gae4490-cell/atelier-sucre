import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { COLONNES_ATELIER, type Atelier, type PhotoGalerie } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

/** Atelier visible : publié, ou non publié mais consulté par l'un de ses membres (aperçu). RLS. */
export const chargerVitrine = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{3,48}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("ateliers").select(COLONNES_ATELIER).eq("slug", slug).maybeSingle();
  if (!data) return null;
  const atelier = data as Atelier;
  const { data: galerie } = await supabase
    .from("galerie")
    .select("id, atelier_id, path, titre, prix_indicatif, position")
    .eq("atelier_id", atelier.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  const { data: pubs } = await supabase
    .from("publications")
    .select("id, code, type, titre, prix_cents, publication_photos(path, path_vignette, position)")
    .eq("atelier_id", atelier.id)
    .eq("statut", "publiee")
    .order("publiee_le", { ascending: false })
    .limit(30);
  const publications = ((pubs ?? []) as unknown as {
    id: string; code: string; type: "creation" | "sur_commande" | "vente_flash"; titre: string; prix_cents: number | null;
    publication_photos: { path: string; path_vignette: string | null; position: number }[];
  }[]).map((p) => ({ ...p, photo: [...p.publication_photos].sort((a, b) => a.position - b.position)[0] ?? null }));
  return { atelier, galerie: (galerie ?? []) as PhotoGalerie[], publications, apercu: !atelier.publie };
});

/** Ancien lien d'un atelier publié (après changement d'adresse). */
export const nouveauSlug = cache(async (ancien: string): Promise<string | null> => {
  if (!/^[a-z0-9-]{3,48}$/.test(ancien)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("slug_historique").select("atelier_id").eq("slug", ancien).maybeSingle();
  if (!data) return null;
  const { data: a } = await admin.from("ateliers").select("slug, publie").eq("id", data.atelier_id).single();
  return a?.publie ? a.slug : null;
});
