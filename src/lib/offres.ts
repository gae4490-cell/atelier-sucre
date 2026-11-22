// Offres d'abonnement — hypothèses de lancement, à modifier ici uniquement.
// Les droits sont vérifiés côté serveur (fonctions offre_active / est_pro en base).

export type IdOffre = "essentiel" | "pro" | "atelier";

export interface Offre {
  id: IdOffre;
  nom: string;
  prixMensuelEuros: number;
  vedette?: boolean;
  aVenir?: boolean;
  limiteDemandesMois: number | null;
  fonctionnalites: string[];
}

export const OFFRES: Offre[] = [
  {
    id: "essentiel",
    nom: "Essentiel",
    prixMensuelEuros: 9,
    limiteDemandesMois: 30,
    fonctionnalites: [
      "1 compte, vitrine personnalisée et lien Instagram",
      "Publications sur la vitrine et dans « Découvrir »",
      "Liens de gâteaux à partager en story",
      "Formulaire avec photo, jusqu'à 30 nouvelles demandes par mois",
      "Alertes par e-mail et dans l'application",
      "Réponse WhatsApp",
    ],
  },
  {
    id: "pro",
    nom: "Pro",
    prixMensuelEuros: 19,
    vedette: true,
    limiteDemandesMois: null,
    fonctionnalites: [
      "Tout Essentiel, demandes illimitées",
      "Devis avec acompte en ligne et suivi des soldes",
      "Calendrier des retraits et dates indisponibles",
      "Ventes flash : réservation, paiement, stock et créneaux",
      "Rappels configurables",
      "Statistiques de devis acceptés et de provenance",
    ],
  },
  {
    id: "atelier",
    nom: "Atelier",
    prixMensuelEuros: 39,
    aVenir: true,
    limiteDemandesMois: null,
    fonctionnalites: [
      "Tout Pro, jusqu'à 5 comptes",
      "Rôles et attribution des demandes et retraits",
      "Calendrier partagé",
      "Export CSV",
    ],
  },
];

export function formaterPrix(euros: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(euros);
}
