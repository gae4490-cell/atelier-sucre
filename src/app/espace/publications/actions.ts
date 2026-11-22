"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigerAtelier } from "@/lib/atelier";
import { eurosVersCentimes } from "@/lib/argent";
import { localVersUtc } from "@/lib/fuseau";
import { nettoyer } from "@/lib/validation";
import { UUID_RE } from "@/lib/navigation";
import { CATEGORIES } from "@/lib/publications";

export type EtatPub = { erreur?: string; succes?: string; pro?: boolean } | null;

const ERREURS: Record<string, string> = {
  offre_pro_requise: "La publication d'une vente flash fait partie de l'offre Pro.",
  titre_requis: "Donnez un titre à votre gâteau.",
  prix_requis: "Indiquez le prix fixe de la vente flash (0,50 € minimum).",
  stock_requis: "Indiquez la quantité disponible.",
  creneau_requis: "Ajoutez au moins un créneau de retrait à venir.",
  stock_inferieur_aux_ventes: "La quantité ne peut pas être inférieure aux réservations déjà faites.",
  prix_fige: "Le prix ne peut plus changer : des réservations existent déjà.",
  type_fige: "Le format ne peut plus changer après publication.",
};
function erreur(e: { message: string } | null, defaut: string): EtatPub {
  const cle = e ? Object.keys(ERREURS).find((k) => e.message.includes(k)) : undefined;
  return { erreur: cle ? ERREURS[cle] : defaut, pro: cle === "offre_pro_requise" };
}

function rafraichir(slug: string, id?: string) {
  revalidatePath("/espace/publications");
  if (id) revalidatePath(`/espace/publications/${id}`);
  revalidatePath(`/p/${slug}`);
  revalidatePath("/decouvrir");
}

export async function creerPublication(type: "creation" | "sur_commande" | "vente_flash") {
  const { supabase, atelier } = await exigerAtelier();
  if (!["creation", "sur_commande", "vente_flash"].includes(type)) return;
  const { data, error } = await supabase
    .from("publications")
    .insert({
      atelier_id: atelier.id,
      type,
      titre: "",
      ...(type === "vente_flash" ? { stock_total: 12, max_par_client: 4 } : {}),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("La publication n'a pas pu être créée.");
  redirect(`/espace/publications/${data.id}`);
}

export async function enregistrerPublication(_: EtatPub, fd: FormData): Promise<EtatPub> {
  const { supabase, atelier } = await exigerAtelier();
  const id = String(fd.get("id") ?? "");
  if (!UUID_RE.test(id)) return { erreur: "Publication introuvable." };
  const type = String(fd.get("type"));
  const prixSaisi = String(fd.get("prix") ?? "").trim();
  const prix = prixSaisi ? eurosVersCentimes(prixSaisi) : null;
  if (prixSaisi && prix === null) return { erreur: "Le prix est illisible (ex. : 18 ou 18,50)." };
  const categorie = nettoyer(fd.get("categorie"), 40);
  const champs: Record<string, unknown> = {
    titre: nettoyer(fd.get("titre"), 90),
    description: nettoyer(fd.get("description"), 2000, true) || null,
    categorie: CATEGORIES.includes(categorie as (typeof CATEGORIES)[number]) ? categorie : null,
    prix_cents: prix,
    disponibilite: nettoyer(fd.get("disponibilite"), 160) || null,
  };
  if (type === "vente_flash") {
    const stock = Number(fd.get("stock_total"));
    const max = Number(fd.get("max_par_client") || 4);
    if (!Number.isInteger(stock) || stock < 1 || stock > 1000) return { erreur: "La quantité doit être comprise entre 1 et 1000." };
    if (!Number.isInteger(max) || max < 1 || max > 50) return { erreur: "Le maximum par client doit être compris entre 1 et 50." };
    champs.stock_total = stock;
    champs.max_par_client = max;
  }
  const { error } = await supabase.from("publications").update(champs).eq("id", id).eq("atelier_id", atelier.id);
  if (error) return erreur(error, "L'enregistrement a échoué.");
  rafraichir(atelier.slug, id);

  const action = fd.get("action");
  if (action === "publier") return publier(id);
  return { succes: "Brouillon enregistré." };
}

async function publier(id: string): Promise<EtatPub> {
  const { supabase, atelier } = await exigerAtelier();
  const { count } = await supabase.from("publication_photos").select("id", { count: "exact", head: true }).eq("publication_id", id);
  if (!count) return { erreur: "Ajoutez au moins une photo avant de publier." };
  const { error } = await supabase.from("publications").update({ statut: "publiee" }).eq("id", id).eq("atelier_id", atelier.id);
  if (error) return erreur(error, "La publication a échoué.");
  rafraichir(atelier.slug, id);
  return { succes: "Votre gâteau est en ligne : sur votre vitrine et dans « Découvrir »." };
}

export async function publierPublication(id: string): Promise<EtatPub> {
  if (!UUID_RE.test(id)) return { erreur: "Publication introuvable." };
  return publier(id);
}

export async function changerStatutPublication(id: string, statut: "archivee" | "brouillon"): Promise<EtatPub> {
  const { supabase, atelier } = await exigerAtelier();
  if (!UUID_RE.test(id)) return { erreur: "Publication introuvable." };
  const { error } = await supabase.from("publications").update({ statut }).eq("id", id).eq("atelier_id", atelier.id);
  if (error) return erreur(error, "La modification a échoué.");
  rafraichir(atelier.slug, id);
  return { succes: statut === "archivee" ? "Publication archivée : elle n'apparaît plus sur la vitrine ni dans le fil." : "Publication repassée en brouillon." };
}

export async function supprimerPublication(id: string) {
  const { supabase, atelier } = await exigerAtelier();
  if (!UUID_RE.test(id)) return;
  const { data: photos } = await supabase.from("publication_photos").select("path, path_vignette").eq("publication_id", id);
  const { data } = await supabase.from("publications").delete().eq("id", id).eq("statut", "brouillon").select("id");
  if (data?.length && photos?.length) {
    await supabase.storage.from("vitrines").remove(photos.flatMap((p) => [p.path, p.path_vignette].filter(Boolean) as string[]));
  }
  rafraichir(atelier.slug);
  redirect("/espace/publications");
}

export async function ajouterPhotoPublication(publicationId: string, chemin: string, vignette: string): Promise<EtatPub> {
  const { supabase, atelier } = await exigerAtelier();
  if (!UUID_RE.test(publicationId) || !chemin.startsWith(`${atelier.id}/`) || !vignette.startsWith(`${atelier.id}/`)) return { erreur: "Fichier invalide." };
  const { count } = await supabase.from("publication_photos").select("id", { count: "exact", head: true }).eq("publication_id", publicationId);
  if ((count ?? 0) >= 8) {
    await supabase.storage.from("vitrines").remove([chemin, vignette]);
    return { erreur: "8 photos maximum par publication." };
  }
  const { error } = await supabase
    .from("publication_photos")
    .insert({ publication_id: publicationId, atelier_id: atelier.id, path: chemin, path_vignette: vignette, position: count ?? 0 });
  if (error) return { erreur: "La photo n'a pas pu être ajoutée." };
  rafraichir(atelier.slug, publicationId);
  return { succes: "Photo ajoutée." };
}

export async function supprimerPhotoPublication(photoId: string, publicationId: string): Promise<EtatPub> {
  const { supabase, atelier } = await exigerAtelier();
  if (!UUID_RE.test(photoId)) return { erreur: "Photo introuvable." };
  const { data } = await supabase.from("publication_photos").delete().eq("id", photoId).select("path, path_vignette").maybeSingle();
  if (data) await supabase.storage.from("vitrines").remove([data.path, data.path_vignette].filter(Boolean) as string[]);
  rafraichir(atelier.slug, publicationId);
  return { succes: "Photo retirée." };
}

export async function ajouterCreneau(_: EtatPub, fd: FormData): Promise<EtatPub> {
  const { supabase, atelier } = await exigerAtelier();
  const publicationId = String(fd.get("publication_id") ?? "");
  if (!UUID_RE.test(publicationId)) return { erreur: "Publication introuvable." };
  const date = String(fd.get("date") ?? "");
  const debut = localVersUtc(date, String(fd.get("debut") ?? ""), atelier.fuseau);
  const fin = localVersUtc(date, String(fd.get("fin") ?? ""), atelier.fuseau);
  const capaciteSaisie = String(fd.get("capacite") ?? "").trim();
  const capacite = capaciteSaisie ? Number(capaciteSaisie) : null;
  if (!debut || !fin) return { erreur: "Indiquez la date, l'heure de début et l'heure de fin." };
  if (fin <= debut) return { erreur: "L'heure de fin doit être après l'heure de début." };
  if (new Date(debut).getTime() <= Date.now()) return { erreur: "Le créneau doit être dans le futur." };
  if (capacite !== null && (!Number.isInteger(capacite) || capacite < 1)) return { erreur: "La capacité doit être un nombre entier positif." };
  const { error } = await supabase.from("creneaux").insert({ publication_id: publicationId, atelier_id: atelier.id, debut, fin, capacite });
  if (error) return { erreur: "Le créneau n'a pas pu être ajouté." };
  rafraichir(atelier.slug, publicationId);
  return { succes: "Créneau ajouté." };
}

export async function supprimerCreneau(id: string, publicationId: string): Promise<EtatPub> {
  const { supabase, atelier } = await exigerAtelier();
  if (!UUID_RE.test(id)) return { erreur: "Créneau introuvable." };
  const { data } = await supabase.from("creneaux").delete().eq("id", id).select("id");
  rafraichir(atelier.slug, publicationId);
  return data?.length ? { succes: "Créneau retiré." } : { erreur: "Ce créneau a déjà des réservations : il ne peut pas être retiré." };
}
