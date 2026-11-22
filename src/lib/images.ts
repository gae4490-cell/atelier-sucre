// Contrôle des images envoyées : on se fie aux octets, pas au nom ni au type annoncé.

export const IMAGE_TAILLE_MAX = 5 * 1024 * 1024; // 5 Mo (aligné sur le bucket Supabase)
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type TypeImage = (typeof IMAGE_TYPES)[number];

export function detecterTypeImage(o: Uint8Array): TypeImage | null {
  if (o.length >= 3 && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff) return "image/jpeg";
  if (
    o.length >= 8 &&
    o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4e && o[3] === 0x47 &&
    o[4] === 0x0d && o[5] === 0x0a && o[6] === 0x1a && o[7] === 0x0a
  ) return "image/png";
  if (
    o.length >= 12 &&
    o[0] === 0x52 && o[1] === 0x49 && o[2] === 0x46 && o[3] === 0x46 &&
    o[8] === 0x57 && o[9] === 0x45 && o[10] === 0x42 && o[11] === 0x50
  ) return "image/webp";
  return null;
}

export function extensionPour(type: TypeImage): string {
  return type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
}

export function verifierImage(octets: Uint8Array): { ok: true; type: TypeImage } | { ok: false; erreur: string } {
  if (octets.length === 0) return { ok: false, erreur: "Le fichier est vide." };
  if (octets.length > IMAGE_TAILLE_MAX) return { ok: false, erreur: "La photo dépasse 5 Mo." };
  const type = detecterTypeImage(octets);
  if (!type) return { ok: false, erreur: "Format non accepté. Utilisez une photo JPEG, PNG ou WebP." };
  return { ok: true, type };
}
