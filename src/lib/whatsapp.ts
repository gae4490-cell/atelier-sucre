// Lien « Répondre sur WhatsApp » avec message prérempli modifiable.

export interface InfosMessage {
  prenom: string;
  nomAtelier: string;
  dateLisible: string;
  nbParts: number;
  theme?: string | null;
}

export function messageParDefaut(i: InfosMessage): string {
  const projet = i.theme ? `votre gâteau « ${i.theme} »` : "votre gâteau";
  return (
    `Bonjour ${i.prenom}, ici ${i.nomAtelier} 🎂\n` +
    `Merci pour votre demande pour ${projet} de ${i.nbParts} parts le ${i.dateLisible}.\n` +
    `Je reviens vers vous avec un devis très vite. Avez-vous d'autres précisions à me donner ?`
  );
}

/**
 * Construit https://wa.me/{numéro}?text=... (numéro international sans « + »).
 * Fonctionne dans le navigateur intégré d'Instagram, sur mobile et sur ordinateur.
 */
export function lienWhatsApp(telephoneInternational: string, message: string): string {
  const numero = telephoneInternational.replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}
