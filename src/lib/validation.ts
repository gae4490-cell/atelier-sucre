// Validation des demandes clients — utilisée côté serveur (autorité) et côté
// navigateur (confort). Module sans dépendance pour être testable avec node:test.

export const LIMITES = {
  prenom: 60,
  email: 254,
  telephone: 30,
  theme: 120,
  parfum: 60,
  typeEvenement: 60,
  budget: 40,
  message: 2000,
  adresse: 300,
  partsMin: 1,
  partsMax: 500,
  joursMaxAvance: 366,
} as const;

export const BUDGETS = [
  "Moins de 50 €",
  "50 à 80 €",
  "80 à 120 €",
  "120 à 200 €",
  "Plus de 200 €",
  "Je ne sais pas encore",
] as const;

export type ModeRetrait = "retrait" | "livraison";

export interface DemandeBrute {
  prenom?: unknown;
  email?: unknown;
  telephone?: unknown;
  date_souhaitee?: unknown;
  nb_parts?: unknown;
  type_evenement?: unknown;
  theme?: unknown;
  parfum?: unknown;
  budget_indicatif?: unknown;
  message?: unknown;
  mode?: unknown;
  adresse_livraison?: unknown;
}

export interface DemandeValide {
  prenom: string;
  email: string;
  telephone: string;
  date_souhaitee: string; // AAAA-MM-JJ
  nb_parts: number;
  type_evenement: string | null;
  theme: string | null;
  parfum: string | null;
  budget_indicatif: string | null;
  message: string | null;
  mode: ModeRetrait;
  adresse_livraison: string | null;
}

export interface ContexteAtelier {
  delaiMinJours: number;
  datesBloquees: string[]; // AAAA-MM-JJ
  retraitActif: boolean;
  livraisonActive: boolean;
  aujourdhui: string; // AAAA-MM-JJ (fuseau Europe/Paris)
}

export type ResultatValidation =
  | { ok: true; data: DemandeValide }
  | { ok: false; erreurs: Record<string, string> };

/** Nettoie une chaîne : espaces superflus, caractères de contrôle retirés. */
export function nettoyer(valeur: unknown, max: number, multiligne = false): string {
  if (typeof valeur !== "string") return "";
  let s = valeur.normalize("NFC");
  s = multiligne
    ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n")
    : s.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ");
  s = s.trim();
  return s.length > max ? s.slice(0, max) : s;
}

export function emailValide(email: string): boolean {
  return email.length <= LIMITES.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Normalise un numéro de téléphone au format international sans « + »,
 * en considérant les numéros à 10 chiffres commençant par 0 comme français.
 * Renvoie null si le numéro est inexploitable.
 */
export function normaliserTelephone(brut: string): string | null {
  const s = brut.replace(/[\s.\-()]/g, "");
  let chiffres: string;
  if (s.startsWith("+")) chiffres = s.slice(1);
  else if (s.startsWith("00")) chiffres = s.slice(2);
  else if (/^0[1-9]\d{8}$/.test(s)) chiffres = "33" + s.slice(1);
  else chiffres = s;
  if (!/^\d{8,15}$/.test(chiffres)) return null;
  if (chiffres.startsWith("330")) chiffres = "33" + chiffres.slice(3); // +33 0 6...
  return chiffres;
}

/** Affichage lisible : 33612345678 -> +33 6 12 34 56 78 */
export function formaterTelephone(international: string): string {
  if (/^33\d{9}$/.test(international)) {
    const n = international.slice(2);
    return `+33 ${n[0]} ${n.slice(1, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
  }
  return `+${international}`;
}

// ---------------------------------------------------------------------------
// Dates (chaînes AAAA-MM-JJ, calculs en UTC pour éviter les décalages d'heure)
// ---------------------------------------------------------------------------

export function dateValide(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(iso + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function ajouterJours(iso: string, jours: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

/** Date du jour dans le fuseau donné (par défaut Europe/Paris). */
export function aujourdhuiA(fuseau = "Europe/Paris", maintenant = new Date()): string {
  // en-CA formate en AAAA-MM-JJ
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuseau,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(maintenant);
}

export function premiereDatePossible(ctx: Pick<ContexteAtelier, "aujourdhui" | "delaiMinJours">): string {
  return ajouterJours(ctx.aujourdhui, Math.max(0, ctx.delaiMinJours));
}

/** Message d'erreur si la date n'est pas réservable, sinon null. */
export function verifierDate(iso: string, ctx: ContexteAtelier): string | null {
  if (!dateValide(iso)) return "Choisissez une date valide.";
  const min = premiereDatePossible(ctx);
  if (iso < min) {
    return ctx.delaiMinJours > 0
      ? `Le pâtissier demande au moins ${ctx.delaiMinJours} jour${ctx.delaiMinJours > 1 ? "s" : ""} de délai. Première date possible : ${formaterDateCourte(min)}.`
      : "Cette date est déjà passée.";
  }
  if (iso > ajouterJours(ctx.aujourdhui, LIMITES.joursMaxAvance)) {
    return "Les demandes sont acceptées jusqu'à un an à l'avance.";
  }
  if (ctx.datesBloquees.includes(iso)) {
    return "Le pâtissier n'est pas disponible à cette date. Choisissez un autre jour.";
  }
  return null;
}

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** 2026-12-05 -> « sam. 5 déc. 2026 » */
export function formaterDateCourte(iso: string): string {
  if (!dateValide(iso)) return iso;
  const d = new Date(iso + "T00:00:00Z");
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ---------------------------------------------------------------------------
// Validation complète
// ---------------------------------------------------------------------------

export function validerDemande(brut: DemandeBrute, ctx: ContexteAtelier): ResultatValidation {
  const erreurs: Record<string, string> = {};

  const prenom = nettoyer(brut.prenom, LIMITES.prenom);
  if (!prenom) erreurs.prenom = "Indiquez votre prénom.";

  const email = nettoyer(brut.email, LIMITES.email).toLowerCase();
  if (!email) erreurs.email = "Indiquez votre e-mail.";
  else if (!emailValide(email)) erreurs.email = "Cette adresse e-mail semble incorrecte.";

  const telBrut = nettoyer(brut.telephone, LIMITES.telephone);
  const telephone = telBrut ? normaliserTelephone(telBrut) : null;
  if (!telBrut) erreurs.telephone = "Indiquez votre numéro de téléphone.";
  else if (!telephone) erreurs.telephone = "Ce numéro de téléphone semble incorrect.";

  const date = nettoyer(brut.date_souhaitee, 10);
  if (!date) erreurs.date_souhaitee = "Choisissez la date souhaitée.";
  else {
    const e = verifierDate(date, ctx);
    if (e) erreurs.date_souhaitee = e;
  }

  const partsTexte = typeof brut.nb_parts === "number" ? String(brut.nb_parts) : nettoyer(brut.nb_parts, 4);
  const nbParts = /^\d{1,4}$/.test(partsTexte) ? Number(partsTexte) : NaN;
  if (!partsTexte) erreurs.nb_parts = "Indiquez le nombre de parts.";
  else if (!Number.isInteger(nbParts) || nbParts < LIMITES.partsMin || nbParts > LIMITES.partsMax) {
    erreurs.nb_parts = `Le nombre de parts doit être compris entre ${LIMITES.partsMin} et ${LIMITES.partsMax}.`;
  }

  const modeBrut = nettoyer(brut.mode, 10);
  let mode: ModeRetrait | null = null;
  if (modeBrut === "retrait" && ctx.retraitActif) mode = "retrait";
  else if (modeBrut === "livraison" && ctx.livraisonActive) mode = "livraison";
  else if (!modeBrut && ctx.retraitActif && !ctx.livraisonActive) mode = "retrait";
  else if (!modeBrut && ctx.livraisonActive && !ctx.retraitActif) mode = "livraison";
  if (!mode) erreurs.mode = "Choisissez retrait ou livraison.";

  const adresse = nettoyer(brut.adresse_livraison, LIMITES.adresse);
  if (mode === "livraison" && !adresse) erreurs.adresse_livraison = "Indiquez l'adresse ou la ville de livraison.";

  const message = nettoyer(brut.message, LIMITES.message, true);

  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };

  return {
    ok: true,
    data: {
      prenom,
      email,
      telephone: telephone!,
      date_souhaitee: date,
      nb_parts: nbParts,
      type_evenement: nettoyer(brut.type_evenement, LIMITES.typeEvenement) || null,
      theme: nettoyer(brut.theme, LIMITES.theme) || null,
      parfum: nettoyer(brut.parfum, LIMITES.parfum) || null,
      budget_indicatif: nettoyer(brut.budget_indicatif, LIMITES.budget) || null,
      message: message || null,
      mode: mode!,
      adresse_livraison: mode === "livraison" ? adresse : null,
    },
  };
}
