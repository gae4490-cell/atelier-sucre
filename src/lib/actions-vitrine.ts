"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigerAtelier, exigerUtilisateur } from "@/lib/atelier";
import { nettoyer, dateValide, emailValide } from "@/lib/validation";
import { slugifier, verifierSlug } from "@/lib/slug";
import { UUID_RE } from "@/lib/navigation";

export type EtatForm = { erreur?: string; succes?: string } | null;

function rafraichir(slug: string) {
  revalidatePath("/espace", "layout");
  revalidatePath("/bienvenue");
  revalidatePath(`/p/${slug}`);
  revalidatePath(`/p/${slug}/demande`);
}

function instagramPropre(v: unknown): string | null {
  let s = nettoyer(v, 120);
  if (!s) return null;
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : "__invalide__";
}

function lignes(v: unknown, maxElements: number, maxLongueur: number): string[] {
  const s = typeof v === "string" ? v : "";
  const out: string[] = [];
  for (const brut of s.split(/[\n,;]/)) {
    const l = nettoyer(brut, maxLongueur);
    if (l && !out.some((x) => x.toLowerCase() === l.toLowerCase())) out.push(l);
    if (out.length >= maxElements) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Création (première connexion)
// ---------------------------------------------------------------------------

export async function verifierDisponibiliteLien(slug: string): Promise<{ ok: boolean; message: string; suggestion?: string }> {
  const { supabase } = await exigerUtilisateur();
  const s = slugifier(slug);
  const err = verifierSlug(s);
  if (err) return { ok: false, message: err };
  const { data } = await supabase.rpc("slug_disponible", { p_slug: s });
  if (data) return { ok: true, message: "Ce lien est disponible." };
  const { data: suggestion } = await supabase.rpc("suggerer_slug", { p_base: s });
  return { ok: false, message: "Ce lien est déjà utilisé par un autre atelier.", suggestion: (suggestion as string) ?? undefined };
}

export async function creerAtelier(_: EtatForm, fd: FormData): Promise<EtatForm> {
  const { supabase, user } = await exigerUtilisateur();
  const nom = nettoyer(fd.get("nom"), 80);
  const slug = slugifier(String(fd.get("slug") ?? "") || nom);
  const email = nettoyer(fd.get("email_notifications"), 254).toLowerCase() || user.email || "";
  if (nom.length < 2) return { erreur: "Indiquez le nom de votre atelier." };
  const errSlug = verifierSlug(slug);
  if (errSlug) return { erreur: errSlug };
  if (!emailValide(email)) return { erreur: "Indiquez une adresse e-mail valide pour recevoir les demandes." };

  const { error } = await supabase.rpc("creer_atelier", { p_nom: nom, p_slug: slug, p_email: email });
  if (error) {
    if (error.message.includes("slug_pris")) {
      const { data: sug } = await supabase.rpc("suggerer_slug", { p_base: slug });
      return { erreur: `Ce lien est déjà utilisé par un autre atelier.${sug ? ` Essayez « ${sug} ».` : ""}` };
    }
    if (!error.message.includes("atelier_existant")) return { erreur: "La création n'a pas abouti. Réessayez." };
  }
  revalidatePath("/", "layout");
  redirect("/bienvenue?etape=3");
}

export async function enregistrerProfilBienvenue(_: EtatForm, fd: FormData): Promise<EtatForm> {
  const { supabase, atelier } = await exigerAtelier();
  const instagram = instagramPropre(fd.get("instagram"));
  if (instagram === "__invalide__") return { erreur: "Le compte Instagram semble incorrect (ex. : les.gateaux.de.lina)." };
  const retrait = fd.get("retrait_actif") === "on";
  const livraison = fd.get("livraison_active") === "on";
  if (!retrait && !livraison) return { erreur: "Proposez au moins le retrait ou la livraison." };
  const delai = Number(fd.get("delai_min_jours"));
  if (!Number.isInteger(delai) || delai < 0 || delai > 90) return { erreur: "Le délai minimum doit être compris entre 0 et 90 jours." };
  if (!nettoyer(fd.get("ville"), 80)) return { erreur: "Indiquez votre ville." };
  const { error } = await supabase
    .from("ateliers")
    .update({
      accroche: nettoyer(fd.get("accroche"), 120) || null,
      description: nettoyer(fd.get("description"), 1500, true) || null,
      zone_retrait: nettoyer(fd.get("zone_retrait"), 200) || null,
      ville: nettoyer(fd.get("ville"), 80) || null,
      instagram,
      retrait_actif: retrait,
      livraison_active: livraison,
      delai_min_jours: delai,
    })
    .eq("id", atelier.id);
  if (error) return { erreur: "L'enregistrement a échoué. Réessayez." };
  rafraichir(atelier.slug);
  redirect("/bienvenue?etape=4");
}

// ---------------------------------------------------------------------------
// Ma vitrine
// ---------------------------------------------------------------------------

export async function majIdentite(_: EtatForm, fd: FormData): Promise<EtatForm> {
  const { supabase, atelier } = await exigerAtelier();
  const nom = nettoyer(fd.get("nom"), 80);
  const slug = slugifier(String(fd.get("slug") ?? ""));
  const instagram = instagramPropre(fd.get("instagram"));
  if (nom.length < 2) return { erreur: "Indiquez le nom de votre atelier." };
  const errSlug = verifierSlug(slug);
  if (errSlug) return { erreur: errSlug };
  if (instagram === "__invalide__") return { erreur: "Le compte Instagram semble incorrect." };

  const { error } = await supabase
    .from("ateliers")
    .update({
      nom,
      slug,
      accroche: nettoyer(fd.get("accroche"), 120) || null,
      description: nettoyer(fd.get("description"), 1500, true) || null,
      instagram,
      ville: nettoyer(fd.get("ville"), 80) || null,
      contact_public: nettoyer(fd.get("contact_public"), 120) || null,
    })
    .eq("id", atelier.id);
  if (error) {
    if (error.code === "23505" || error.message.includes("slug_pris")) return { erreur: "Ce lien est déjà utilisé par un autre atelier." };
    return { erreur: "L'enregistrement a échoué. Réessayez." };
  }
  rafraichir(atelier.slug);
  if (slug !== atelier.slug) rafraichir(slug);
  return { succes: slug !== atelier.slug ? "Enregistré. Pensez à mettre à jour le lien dans votre bio Instagram." : "Modifications enregistrées." };
}

export async function majRetrait(_: EtatForm, fd: FormData): Promise<EtatForm> {
  const { supabase, atelier } = await exigerAtelier();
  const retrait = fd.get("retrait_actif") === "on";
  const livraison = fd.get("livraison_active") === "on";
  if (!retrait && !livraison) return { erreur: "Proposez au moins le retrait ou la livraison." };
  const delai = Number(fd.get("delai_min_jours"));
  if (!Number.isInteger(delai) || delai < 0 || delai > 90) return { erreur: "Le délai minimum doit être compris entre 0 et 90 jours." };
  const { error } = await supabase
    .from("ateliers")
    .update({
      retrait_actif: retrait,
      livraison_active: livraison,
      zone_retrait: nettoyer(fd.get("zone_retrait"), 200) || null,
      horaires_retrait: nettoyer(fd.get("horaires_retrait"), 300, true) || null,
      livraison_note: nettoyer(fd.get("livraison_note"), 300) || null,
      delai_min_jours: delai,
    })
    .eq("id", atelier.id);
  if (error) return { erreur: "L'enregistrement a échoué. Réessayez." };
  rafraichir(atelier.slug);
  return { succes: "Modifications enregistrées." };
}

export async function majFormulaire(_: EtatForm, fd: FormData): Promise<EtatForm> {
  const { supabase, atelier } = await exigerAtelier();
  const types = lignes(fd.get("types_evenement"), 20, 60);
  const parfums = lignes(fd.get("parfums"), 30, 60);
  const { error } = await supabase
    .from("ateliers")
    .update({
      types_evenement: types,
      parfums,
      afficher_tarifs: fd.get("afficher_tarifs") === "on",
      tarifs_note: nettoyer(fd.get("tarifs_note"), 800, true) || null,
    })
    .eq("id", atelier.id);
  if (error) return { erreur: "L'enregistrement a échoué. Réessayez." };
  rafraichir(atelier.slug);
  return { succes: "Modifications enregistrées." };
}

export async function majImage(champ: "logo_path" | "couverture_path", chemin: string | null): Promise<EtatForm> {
  const { supabase, atelier } = await exigerAtelier();
  if (chemin !== null && !chemin.startsWith(`${atelier.id}/`)) return { erreur: "Fichier invalide." };
  const ancien = atelier[champ];
  const { error } = await supabase.from("ateliers").update({ [champ]: chemin }).eq("id", atelier.id);
  if (error) return { erreur: "L'enregistrement a échoué." };
  if (ancien && ancien !== chemin) await supabase.storage.from("vitrines").remove([ancien]);
  rafraichir(atelier.slug);
  return { succes: "Photo enregistrée." };
}

export async function publierVitrine(publie: boolean): Promise<EtatForm> {
  const { supabase, atelier } = await exigerAtelier();
  const { error } = await supabase.from("ateliers").update({ publie }).eq("id", atelier.id);
  if (error) return { erreur: "La modification n'a pas abouti." };
  rafraichir(atelier.slug);
  return { succes: publie ? "Votre vitrine est en ligne." : "Votre vitrine est hors ligne." };
}

export async function publierDepuisBienvenue() {
  const r = await publierVitrine(true);
  if (r?.erreur) return r;
  redirect("/bienvenue?etape=5");
}

export async function ajouterPhotoGalerie(chemin: string, titre: string, prix: string): Promise<EtatForm> {
  const { supabase, atelier } = await exigerAtelier();
  if (!chemin.startsWith(`${atelier.id}/`)) return { erreur: "Fichier invalide." };
  const { count } = await supabase.from("galerie").select("id", { count: "exact", head: true }).eq("atelier_id", atelier.id);
  if ((count ?? 0) >= 24) {
    await supabase.storage.from("vitrines").remove([chemin]);
    return { erreur: "La galerie contient déjà 24 photos. Retirez-en une pour en ajouter une autre." };
  }
  const { error } = await supabase.from("galerie").insert({
    atelier_id: atelier.id,
    path: chemin,
    titre: nettoyer(titre, 80) || null,
    prix_indicatif: nettoyer(prix, 40) || null,
    position: count ?? 0,
  });
  if (error) return { erreur: "La photo n'a pas pu être ajoutée." };
  rafraichir(atelier.slug);
  return { succes: "Photo ajoutée à la galerie." };
}

export async function majPhotoGalerie(id: string, titre: string, prix: string): Promise<EtatForm> {
  const { supabase, atelier } = await exigerAtelier();
  if (!UUID_RE.test(id)) return { erreur: "Photo introuvable." };
  const { error } = await supabase
    .from("galerie")
    .update({ titre: nettoyer(titre, 80) || null, prix_indicatif: nettoyer(prix, 40) || null })
    .eq("id", id)
    .eq("atelier_id", atelier.id);
  if (error) return { erreur: "La modification n'a pas abouti." };
  rafraichir(atelier.slug);
  return { succes: "Légende enregistrée." };
}

export async function supprimerPhotoGalerie(id: string): Promise<EtatForm> {
  const { supabase, atelier } = await exigerAtelier();
  if (!UUID_RE.test(id)) return { erreur: "Photo introuvable." };
  const { data } = await supabase.from("galerie").delete().eq("id", id).eq("atelier_id", atelier.id).select("path").maybeSingle();
  if (data?.path) await supabase.storage.from("vitrines").remove([data.path]);
  rafraichir(atelier.slug);
  return { succes: "Photo retirée." };
}

export async function ajouterDateBloquee(_: EtatForm, fd: FormData): Promise<EtatForm> {
  const { supabase, atelier } = await exigerAtelier();
  const du = nettoyer(fd.get("du"), 10);
  const au = nettoyer(fd.get("au"), 10) || du;
  const motif = nettoyer(fd.get("motif"), 120) || null;
  if (!dateValide(du) || !dateValide(au) || au < du) return { erreur: "Choisissez une date (ou une période) valide." };
  const jours: string[] = [];
  for (let d = new Date(du + "T00:00:00Z"); d.toISOString().slice(0, 10) <= au; d.setUTCDate(d.getUTCDate() + 1)) {
    jours.push(d.toISOString().slice(0, 10));
    if (jours.length > 62) return { erreur: "Bloquez au maximum 62 jours à la fois." };
  }
  const { error } = await supabase
    .from("dates_bloquees")
    .upsert(jours.map((jour) => ({ atelier_id: atelier.id, jour, motif })), { onConflict: "atelier_id,jour", ignoreDuplicates: true });
  if (error) return { erreur: "Les dates n'ont pas pu être bloquées." };
  rafraichir(atelier.slug);
  return { succes: jours.length > 1 ? `${jours.length} jours bloqués.` : "Date bloquée." };
}

export async function supprimerDateBloquee(jour: string): Promise<EtatForm> {
  const { supabase, atelier } = await exigerAtelier();
  if (!dateValide(jour)) return { erreur: "Date invalide." };
  await supabase.from("dates_bloquees").delete().eq("atelier_id", atelier.id).eq("jour", jour);
  rafraichir(atelier.slug);
  return { succes: "Date débloquée." };
}

export async function majReglagesNotifications(_: EtatForm, fd: FormData): Promise<EtatForm> {
  const { supabase, atelier } = await exigerAtelier();
  const email = nettoyer(fd.get("email_notifications"), 254).toLowerCase();
  if (!emailValide(email)) return { erreur: "Indiquez une adresse e-mail valide." };
  const { error } = await supabase
    .from("atelier_reglages")
    .update({
      email_notifications: email,
      rappel_demande_24h: fd.get("rappel_demande_24h") === "on",
      rappel_retrait_client: fd.get("rappel_retrait_client") === "on",
      recap_quotidien: fd.get("recap_quotidien") === "on",
    })
    .eq("atelier_id", atelier.id);
  if (error) return { erreur: "L'enregistrement a échoué." };
  revalidatePath("/espace/notifications");
  return { succes: "Préférences enregistrées." };
}
