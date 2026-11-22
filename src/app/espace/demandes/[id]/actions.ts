"use server";

import { revalidatePath } from "next/cache";
import { exigerAtelier } from "@/lib/atelier";
import { nettoyer } from "@/lib/validation";
import { UUID_RE } from "@/lib/navigation";

export type EtatNote = { erreur?: string; succes?: string } | null;

export async function enregistrerNote(_: EtatNote, fd: FormData): Promise<EtatNote> {
  const { supabase, atelier } = await exigerAtelier();
  const id = String(fd.get("id") ?? "");
  if (!UUID_RE.test(id)) return { erreur: "Demande introuvable." };
  const note = nettoyer(fd.get("note_privee"), 4000, true) || null;
  const { data, error } = await supabase
    .from("demandes")
    .update({ note_privee: note })
    .eq("id", id)
    .eq("atelier_id", atelier.id)
    .select("id");
  if (error || !data?.length) return { erreur: "La note n'a pas pu être enregistrée." };
  revalidatePath(`/espace/demandes/${id}`);
  return { succes: "Note enregistrée." };
}

export async function changerStatutSimple(id: string, statut: "refusee" | "nouvelle"): Promise<EtatNote> {
  const { supabase, atelier } = await exigerAtelier();
  if (!UUID_RE.test(id)) return { erreur: "Demande introuvable." };
  // Livraison 1 : seuls « décliner » et « rouvrir » sont possibles ; les autres étapes
  // seront pilotées par les devis et paiements.
  const depuis = statut === "refusee" ? ["nouvelle"] : ["refusee"];
  const { data, error } = await supabase
    .from("demandes")
    .update({ statut })
    .eq("id", id)
    .eq("atelier_id", atelier.id)
    .in("statut", depuis)
    .select("id");
  if (error || !data?.length) return { erreur: "Le statut n'a pas pu être modifié." };
  revalidatePath("/espace", "layout");
  return { succes: statut === "refusee" ? "Demande déclinée." : "Demande rouverte." };
}
