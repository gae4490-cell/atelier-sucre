// Vérification de la signature des webhooks Stripe (en-tête Stripe-Signature), sans SDK.
// Schéma : t=<horodatage>,v1=<HMAC-SHA256(secret, "t.payload")>[,v1=...]
import { createHmac, timingSafeEqual } from "node:crypto";

export function signerStripe(payload: string, secret: string, horodatage: number): string {
  const sig = createHmac("sha256", secret).update(`${horodatage}.${payload}`).digest("hex");
  return `t=${horodatage},v1=${sig}`;
}

export function verifierSignatureStripe(
  payload: string,
  entete: string | null,
  secret: string,
  toleranceSecondes = 300,
  maintenant = Math.floor(Date.now() / 1000),
): boolean {
  if (!entete || !secret) return false;
  let t: number | null = null;
  const signatures: string[] = [];
  for (const partie of entete.split(",")) {
    const [cle, valeur] = partie.split("=", 2);
    if (cle === "t" && /^\d+$/.test(valeur ?? "")) t = Number(valeur);
    if (cle === "v1" && valeur) signatures.push(valeur);
  }
  if (t === null || signatures.length === 0) return false;
  if (Math.abs(maintenant - t) > toleranceSecondes) return false;
  const attendu = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex"), "utf8");
  return signatures.some((s) => {
    const b = Buffer.from(s, "utf8");
    return b.length === attendu.length && timingSafeEqual(b, attendu);
  });
}

/** Encodage application/x-www-form-urlencoded au format attendu par l'API Stripe (objets imbriqués). */
export function encoderStripe(obj: Record<string, unknown>, prefixe = ""): string {
  const parties: string[] = [];
  for (const [cle, valeur] of Object.entries(obj)) {
    if (valeur === undefined || valeur === null) continue;
    const nom = prefixe ? `${prefixe}[${cle}]` : cle;
    if (Array.isArray(valeur)) {
      valeur.forEach((v, i) => {
        if (v !== null && typeof v === "object") parties.push(encoderStripe(v as Record<string, unknown>, `${nom}[${i}]`));
        else parties.push(`${encodeURIComponent(`${nom}[${i}]`)}=${encodeURIComponent(String(v))}`);
      });
    } else if (typeof valeur === "object") {
      parties.push(encoderStripe(valeur as Record<string, unknown>, nom));
    } else {
      parties.push(`${encodeURIComponent(nom)}=${encodeURIComponent(String(valeur))}`);
    }
  }
  return parties.filter(Boolean).join("&");
}
