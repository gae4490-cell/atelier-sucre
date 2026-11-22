// Montants en centimes partout ; conversion uniquement à l'affichage et à la saisie.

export function formaterEuros(cents: number | null | undefined, avecCentimes?: boolean): string {
  const v = (cents ?? 0) / 100;
  const decimales = avecCentimes ?? !Number.isInteger(v);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimales ? 2 : 0,
    maximumFractionDigits: decimales ? 2 : 0,
  })
    .format(v)
    .replace(/ /g, " ");
}

/** « 80 », « 80,50 », « 80.5 », « 1 200 € » -> centimes ; null si illisible. */
export function eurosVersCentimes(saisie: unknown): number | null {
  if (typeof saisie === "number") return Number.isFinite(saisie) ? Math.round(saisie * 100) : null;
  if (typeof saisie !== "string") return null;
  const s = saisie.replace(/[\s  €]/g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [e, d = ""] = s.split(".");
  return Number(e) * 100 + Number((d + "00").slice(0, 2));
}

/** Pour pré-remplir un champ : 2500 -> « 25 », 2550 -> « 25,50 ». */
export function centimesVersSaisie(cents: number | null | undefined): string {
  if (cents == null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ",");
}

export type EtatPaiement = "aucun" | "acompte_attendu" | "acompte_recu" | "solde_du" | "paye";

export function etatPaiement(totalCents: number, acompteCents: number, payeCents: number): EtatPaiement {
  if (totalCents > 0 && payeCents >= totalCents) return "paye";
  if (payeCents === 0) return acompteCents > 0 ? "acompte_attendu" : totalCents > 0 ? "solde_du" : "aucun";
  if (acompteCents > 0 && payeCents >= acompteCents) return "acompte_recu";
  return "solde_du";
}

export const LIBELLE_PAIEMENT: Record<EtatPaiement, string> = {
  aucun: "Aucun paiement",
  acompte_attendu: "Acompte attendu",
  acompte_recu: "Acompte reçu",
  solde_du: "Solde dû",
  paye: "Payé",
};
