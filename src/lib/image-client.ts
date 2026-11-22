// Préparation des photos dans le navigateur (téléphone, navigateur intégré d'Instagram) :
// redimensionnement à 1600 px max et conversion JPEG pour des envois rapides et légers.

const COTE_MAX = 1600;
const TYPES_OK = ["image/jpeg", "image/png", "image/webp"];
export const TAILLE_MAX_CLIENT = 5 * 1024 * 1024;

export class ErreurImage extends Error {}

async function decoder(fichier: File): Promise<{ largeur: number; hauteur: number; dessiner: (ctx: CanvasRenderingContext2D, l: number, h: number) => void; liberer: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(fichier);
      return { largeur: bmp.width, hauteur: bmp.height, dessiner: (c, l, h) => c.drawImage(bmp, 0, 0, l, h), liberer: () => bmp.close() };
    } catch {
      /* repli sur <img> */
    }
  }
  const url = URL.createObjectURL(fichier);
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((ok, ko) => {
    img.onload = () => ok();
    img.onerror = () => ko(new ErreurImage("Cette photo ne peut pas être lue. Essayez une photo JPEG ou PNG."));
    img.src = url;
  });
  return {
    largeur: img.naturalWidth,
    hauteur: img.naturalHeight,
    dessiner: (c, l, h) => c.drawImage(img, 0, 0, l, h),
    liberer: () => URL.revokeObjectURL(url),
  };
}

/** Renvoie une image JPEG allégée, ou le fichier d'origine s'il est déjà conforme. */
export async function preparerImage(fichier: File, coteMax = COTE_MAX): Promise<Blob> {
  let source;
  try {
    source = await decoder(fichier);
  } catch (e) {
    if (TYPES_OK.includes(fichier.type) && fichier.size <= TAILLE_MAX_CLIENT) return fichier;
    throw e instanceof ErreurImage ? e : new ErreurImage("Cette photo ne peut pas être lue. Essayez une photo JPEG ou PNG.");
  }
  try {
    const ratio = Math.min(1, coteMax / Math.max(source.largeur, source.hauteur));
    const l = Math.max(1, Math.round(source.largeur * ratio));
    const h = Math.max(1, Math.round(source.hauteur * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = l;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ErreurImage("Votre navigateur ne permet pas de préparer la photo.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, l, h);
    source.dessiner(ctx, l, h);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    if (!blob) throw new ErreurImage("La photo n'a pas pu être préparée.");
    if (blob.size > TAILLE_MAX_CLIENT) throw new ErreurImage("La photo est trop lourde (5 Mo maximum).");
    return blob;
  } finally {
    source.liberer();
  }
}

/** UUID v4 — fonctionne aussi hors HTTPS (test sur le réseau local), où randomUUID n'existe pas. */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      /* contexte non sécurisé */
    }
  }
  const o = new Uint8Array(16);
  crypto.getRandomValues(o);
  o[6] = (o[6] & 0x0f) | 0x40;
  o[8] = (o[8] & 0x3f) | 0x80;
  const h = Array.from(o, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
