// Liens publics des vitrines : /p/{slug}

export const SLUG_MIN = 3;
export const SLUG_MAX = 48;

const RESERVES = new Set([
  "admin", "api", "app", "aide", "atelier", "atelier-sucre", "auth", "compte", "connexion",
  "demo", "espace", "inscription", "nouveau", "p", "support", "tarifs", "test", "www",
]);

/** « Les Gâteaux de Lina ! » -> « les-gateaux-de-lina » */
export function slugifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

/** Renvoie un message d'erreur ou null si le lien est utilisable. */
export function verifierSlug(slug: string): string | null {
  if (slug.length < SLUG_MIN) return `Le lien doit contenir au moins ${SLUG_MIN} caractères.`;
  if (slug.length > SLUG_MAX) return `Le lien doit contenir au plus ${SLUG_MAX} caractères.`;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])$/.test(slug) || slug.includes("--")) {
    return "Utilisez uniquement des lettres minuscules sans accent, des chiffres et des tirets.";
  }
  if (RESERVES.has(slug)) return "Ce lien est réservé. Choisissez-en un autre.";
  return null;
}
