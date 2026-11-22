import { COMMANDE, type StatutCommande } from "@/lib/statuts";
import { etatPaiement, LIBELLE_PAIEMENT, type EtatPaiement } from "@/lib/argent";

export type CommandeSuivi = {
  id: string;
  numero: number;
  type: "devis" | "vente_flash";
  libelle: string;
  prenom: string;
  email: string;
  telephone: string;
  total_cents: number;
  acompte_cents: number;
  paye_cents: number;
  reste_cents: number;
  statut: StatutCommande;
  date_retrait: string | null;
  heure_retrait: string | null;
  mode: string;
  lieu: string | null;
  note_interne: string | null;
  demande_id: string | null;
  devis_id: string | null;
  reservation_id: string | null;
  created_at: string;
};

const TON_PAIEMENT: Record<EtatPaiement, string> = {
  aucun: "gris",
  acompte_attendu: "ambre",
  acompte_recu: "prune",
  solde_du: "ambre",
  paye: "vert",
};

export function BadgesCommande({ c }: { c: CommandeSuivi }) {
  const ep = etatPaiement(c.total_cents, c.acompte_cents, c.paye_cents);
  return (
    <span className="rangee" style={{ gap: 6 }}>
      <span className={`badge badge-${COMMANDE[c.statut].ton}`}>{COMMANDE[c.statut].l}</span>
      <span className={`badge badge-${TON_PAIEMENT[ep]}`}>{LIBELLE_PAIEMENT[ep]}</span>
    </span>
  );
}
