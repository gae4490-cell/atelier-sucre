/** N'accepte que des chemins internes pour les redirections (pas d'URL externe). */
export function cheminSur(valeur: unknown, defaut = "/espace"): string {
  if (typeof valeur !== "string") return defaut;
  if (!valeur.startsWith("/") || valeur.startsWith("//") || valeur.startsWith("/\\")) return defaut;
  return valeur;
}

export function urlPublique(bucketPath: string | null | undefined, bucket = "vitrines"): string | null {
  if (!bucketPath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${bucketPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export function lienVitrine(slug: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${site}/p/${slug}`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
