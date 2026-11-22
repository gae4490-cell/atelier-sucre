import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COLONNES_ATELIER, type Atelier } from "@/lib/types";

/** Utilisateur connecté (ou redirection vers la connexion). Mis en cache par requête. */
export const exigerUtilisateur = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  return { supabase, user };
});

/** Atelier du pâtissier connecté, lu via RLS. Null s'il n'en a pas encore. */
export const atelierCourant = cache(async (): Promise<Atelier | null> => {
  const { supabase, user } = await exigerUtilisateur();
  const { data: membre } = await supabase
    .from("atelier_membres")
    .select("atelier_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membre) return null;
  const { data } = await supabase.from("ateliers").select(COLONNES_ATELIER).eq("id", membre.atelier_id).single();
  return (data as Atelier | null) ?? null;
});

/** Pour l'espace pâtissier : exige un compte ET un atelier. */
export async function exigerAtelier() {
  const { supabase, user } = await exigerUtilisateur();
  const atelier = await atelierCourant();
  if (!atelier) redirect("/bienvenue");
  return { supabase, user, atelier };
}
