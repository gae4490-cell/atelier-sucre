import type { StatutDemande } from "./statuts";

export interface Atelier {
  id: string;
  slug: string;
  nom: string;
  accroche: string | null;
  description: string | null;
  logo_path: string | null;
  couverture_path: string | null;
  zone_retrait: string | null;
  horaires_retrait: string | null;
  instagram: string | null;
  retrait_actif: boolean;
  livraison_active: boolean;
  livraison_note: string | null;
  delai_min_jours: number;
  afficher_tarifs: boolean;
  tarifs_note: string | null;
  types_evenement: string[];
  parfums: string[];
  publie: boolean;
  publie_le: string | null;
  created_at: string;
  ville: string | null;
  fuseau: string;
  contact_public: string | null;
}

export interface Reglages {
  atelier_id: string;
  email_notifications: string;
  telephone: string | null;
  rappel_demande_24h: boolean;
  rappel_retrait_client: boolean;
  recap_quotidien: boolean;
}

export interface PhotoGalerie {
  id: string;
  atelier_id: string;
  path: string;
  titre: string | null;
  prix_indicatif: string | null;
  position: number;
}

export interface Demande {
  id: string;
  numero: number;
  atelier_id: string;
  prenom: string;
  email: string;
  telephone: string;
  date_souhaitee: string;
  nb_parts: number;
  type_evenement: string | null;
  theme: string | null;
  parfum: string | null;
  budget_indicatif: string | null;
  message: string | null;
  mode: "retrait" | "livraison";
  adresse_livraison: string | null;
  photo_path: string | null;
  statut: StatutDemande;
  note_privee: string | null;
  lue_le: string | null;
  created_at: string;
  publication_id: string | null;
  source: string;
}

export interface Notification {
  id: string;
  atelier_id: string;
  demande_id: string | null;
  type: string;
  titre: string;
  corps: string | null;
  lien: string | null;
  lue_le: string | null;
  created_at: string;
}

export interface LigneEmail {
  id: string;
  type: string;
  destinataire: string;
  sujet: string;
  statut: "en_attente" | "envoye" | "simule" | "echec";
  erreur: string | null;
  tentatives: number;
  created_at: string;
  updated_at: string;
}

export const COLONNES_ATELIER =
  "id, slug, nom, accroche, description, logo_path, couverture_path, zone_retrait, horaires_retrait, instagram, retrait_actif, livraison_active, livraison_note, delai_min_jours, afficher_tarifs, tarifs_note, types_evenement, parfums, publie, publie_le, created_at, ville, fuseau, contact_public";
