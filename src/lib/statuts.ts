export type StatutDemande =
  | "nouvelle"
  | "devis_envoye"
  | "acompte_en_attente"
  | "confirmee"
  | "en_preparation"
  | "prete"
  | "remise"
  | "refusee"
  | "annulee";

export const ETAPES: { statut: StatutDemande; libelle: string; aide: string }[] = [
  { statut: "nouvelle", libelle: "Demande reçue", aide: "Le pâtissier découvre le projet." },
  { statut: "devis_envoye", libelle: "Devis envoyé", aide: "Le client peut lire et accepter l'offre." },
  { statut: "acompte_en_attente", libelle: "Acompte en attente", aide: "Le devis est accepté, le règlement reste à recevoir." },
  { statut: "confirmee", libelle: "Commande confirmée", aide: "Paiement confirmé ou devis accepté sans acompte." },
  { statut: "en_preparation", libelle: "En préparation", aide: "Le pâtissier a commencé." },
  { statut: "prete", libelle: "Prête au retrait", aide: "L'heure et le lieu sont visibles." },
  { statut: "remise", libelle: "Remise", aide: "Commande clôturée, solde vérifié." },
];

export const LIBELLES: Record<StatutDemande, string> = {
  nouvelle: "Nouvelle",
  devis_envoye: "Devis envoyé",
  acompte_en_attente: "Acompte en attente",
  confirmee: "Confirmée",
  en_preparation: "En préparation",
  prete: "Prête",
  remise: "Remise",
  refusee: "Déclinée",
  annulee: "Annulée",
};

export const TON: Record<StatutDemande, "rose" | "prune" | "vert" | "gris" | "ambre"> = {
  nouvelle: "rose",
  devis_envoye: "prune",
  acompte_en_attente: "ambre",
  confirmee: "vert",
  en_preparation: "prune",
  prete: "vert",
  remise: "gris",
  refusee: "gris",
  annulee: "gris",
};

export const STATUTS_EN_COURS: StatutDemande[] = [
  "devis_envoye",
  "acompte_en_attente",
  "confirmee",
  "en_preparation",
  "prete",
];

export function estStatut(v: string | null | undefined): v is StatutDemande {
  return !!v && v in LIBELLES;
}

// --- Devis, commandes, paiements : trois informations distinctes ---------------
export type StatutDevis = "brouillon" | "envoye" | "accepte" | "refuse" | "expire" | "revoque" | "remplace";
export const DEVIS: Record<StatutDevis, { l: string; ton: "rose" | "prune" | "vert" | "gris" | "ambre" }> = {
  brouillon: { l: "Brouillon", ton: "gris" },
  envoye: { l: "Envoyé", ton: "prune" },
  accepte: { l: "Accepté", ton: "vert" },
  refuse: { l: "Refusé", ton: "rose" },
  expire: { l: "Expiré", ton: "gris" },
  revoque: { l: "Révoqué", ton: "gris" },
  remplace: { l: "Remplacé", ton: "gris" },
};

export type StatutCommande = "confirmee" | "en_preparation" | "prete" | "remise" | "annulee";
export const COMMANDE: Record<StatutCommande, { l: string; ton: "rose" | "prune" | "vert" | "gris" | "ambre" }> = {
  confirmee: { l: "Confirmée", ton: "vert" },
  en_preparation: { l: "En préparation", ton: "prune" },
  prete: { l: "Prête", ton: "ambre" },
  remise: { l: "Remise", ton: "gris" },
  annulee: { l: "Annulée", ton: "gris" },
};
export const SUIVANTE: Partial<Record<StatutCommande, { statut: StatutCommande; action: string }>> = {
  confirmee: { statut: "en_preparation", action: "Commencer la préparation" },
  en_preparation: { statut: "prete", action: "Marquer prête au retrait" },
  prete: { statut: "remise", action: "Marquer comme remise" },
};

export const SOURCES: Record<string, string> = {
  decouvrir: "Fil Découvrir",
  instagram: "Lien Instagram marqué",
  lien_partage: "Lien de gâteau partagé",
  vitrine: "Vitrine",
  inconnue: "Source inconnue",
};
