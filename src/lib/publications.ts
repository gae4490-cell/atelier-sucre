// Constantes et types partagés des publications.

export const CATEGORIES = [
  "Gâteau d'anniversaire",
  "Layer cake",
  "Number cake",
  "Wedding cake",
  "Cupcakes",
  "Entremets",
  "Tarte",
  "Biscuits",
  "Box gourmande",
  "Autre",
] as const;

export type TypePublication = "creation" | "sur_commande" | "vente_flash";

export const FORMATS: Record<TypePublication, { nom: string; aide: string; bouton: string }> = {
  creation: { nom: "Création passée", aide: "Montrez une réalisation ; vos clients peuvent demander un gâteau similaire.", bouton: "Je veux un gâteau similaire" },
  sur_commande: { nom: "Sur commande", aide: "Un gâteau à commander avec un prix indicatif.", bouton: "Demander un devis" },
  vente_flash: { nom: "Vente flash", aide: "Quantité limitée, prix fixe, créneaux de retrait et paiement en ligne.", bouton: "Réserver" },
};

export type PublicationPublique = {
  id: string;
  code: string;
  type: TypePublication;
  statut: "brouillon" | "publiee" | "archivee";
  titre: string;
  description: string | null;
  categorie: string | null;
  prix_cents: number | null;
  disponibilite: string | null;
  stock_total: number | null;
  max_par_client: number;
  publiee_le: string | null;
  atelier_id: string;
};

export const COLONNES_PUBLICATION =
  "id, code, type, statut, titre, description, categorie, prix_cents, disponibilite, stock_total, max_par_client, publiee_le, atelier_id";

/** Provenance acceptée dans les liens (?src=...). */
export function sourceDepuis(param: unknown): "decouvrir" | "instagram" | "lien_partage" | "vitrine" | "inconnue" {
  return param === "decouvrir" || param === "instagram" || param === "lien_partage" || param === "vitrine" ? param : "inconnue";
}
