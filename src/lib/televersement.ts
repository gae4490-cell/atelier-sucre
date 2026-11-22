"use client";

import { createClient } from "@/lib/supabase/client";
import { preparerImage, uuid } from "@/lib/image-client";

/**
 * Envoie une image de vitrine (logo, couverture, galerie) dans le dossier de l'atelier.
 * Les règles de stockage n'acceptent que le dossier {atelier_id}/ d'un membre.
 */
export async function televerserImageVitrine(fichier: File, atelierId: string, prefixe: string): Promise<string> {
  const blob = await preparerImage(fichier);
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const chemin = `${atelierId}/${prefixe}-${uuid()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("vitrines").upload(chemin, blob, {
    contentType: blob.type || "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error("L'envoi de la photo a échoué. Vérifiez votre connexion et réessayez.");
  return chemin;
}

/** Photo de publication : grande image (1600 px) + vignette (640 px) pour le fil. */
export async function televerserPhotoPublication(fichier: File, atelierId: string): Promise<{ chemin: string; vignette: string }> {
  const [grande, petite] = await Promise.all([preparerImage(fichier, 1600), preparerImage(fichier, 640)]);
  const base = `${atelierId}/pub-${uuid()}`;
  const supabase = createClient();
  for (const [blob, chemin] of [[grande, `${base}.jpg`], [petite, `${base}-m.jpg`]] as const) {
    const { error } = await supabase.storage.from("vitrines").upload(chemin, blob, { contentType: blob.type || "image/jpeg", cacheControl: "31536000", upsert: false });
    if (error) throw new Error("L'envoi de la photo a échoué. Vérifiez votre connexion et réessayez.");
  }
  return { chemin: `${base}.jpg`, vignette: `${base}-m.jpg` };
}
