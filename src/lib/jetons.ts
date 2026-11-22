// Liens privés (devis, solde) : jeton aléatoire de 256 bits, seule l'empreinte SHA-256 est stockée.
import { createHash, randomBytes } from "node:crypto";

export function genererJeton(): string {
  return randomBytes(32).toString("base64url");
}

export function hacherJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

export function jetonPlausible(jeton: unknown): jeton is string {
  return typeof jeton === "string" && /^[A-Za-z0-9_-]{43}$/.test(jeton);
}
