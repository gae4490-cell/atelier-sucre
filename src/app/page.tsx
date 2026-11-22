import Link from "next/link";
import { EntetePublique } from "@/components/EntetePublique";
import { IcoBulle, IcoCalendrier, IcoCarte, IcoCloche, IcoDocument, IcoInstagram, IcoWhatsApp } from "@/components/icones";

const FONCTIONS = [
  { icone: <IcoInstagram />, titre: "Un lien pour votre bio", texte: "Une vitrine à votre nom et un formulaire de devis pensé pour le téléphone." },
  { icone: <IcoCloche />, titre: "Alerte à chaque demande", texte: "E-mail et alerte dans votre espace, avec la photo d'inspiration du client." },
  { icone: <IcoWhatsApp />, titre: "Réponse WhatsApp", texte: "Un message prérempli que vous ajustez avant de l'envoyer." },
  { icone: <IcoDocument />, titre: "Devis et acomptes", texte: "Envoyez un devis, encaissez l'acompte, suivez le solde." },
  { icone: <IcoCalendrier />, titre: "Calendrier", texte: "Vos dates demandées, confirmées et bloquées au même endroit." },
  { icone: <IcoCarte />, titre: "Ventes flash", texte: "Box en quantité limitée, créneaux de retrait et paiement en ligne, sans survente." },
];

export default function Accueil() {
  return (
    <>
      <EntetePublique />
      <main>
        <section className="conteneur" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32, alignItems: "center", padding: "24px 20px 40px" }}>
          <div>
            <p className="doux" style={{ letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.78rem" }}>Le logiciel des pâtissières et pâtissiers créatifs</p>
            <h1 style={{ fontSize: "clamp(2.4rem, 7vw, 3.8rem)" }}>Gérez vos commandes de gâteaux sur mesure</h1>
            <p className="rangee" style={{ gap: 12, fontSize: "1.1rem", flexWrap: "nowrap", alignItems: "flex-start" }}>
              <IcoInstagram taille={30} style={{ color: "var(--rose-vif)", flex: "none" }} />
              Les demandes de vos clients, directement depuis votre bio Instagram.
            </p>
            <div className="rangee" style={{ marginTop: 24 }}>
              <Link href="/inscription" className="btn btn-primaire"><IcoBulle /> Créer mon atelier</Link>
              <Link href="/decouvrir" className="btn btn-fantome">Découvrir les gâteaux</Link>
            </div>
          </div>
          <div className="photo" style={{ borderRadius: 28, aspectRatio: "458 / 451", boxShadow: "var(--ombre)" }}>
            <img src="/images/gateaux-accueil.jpg" alt="Un gâteau thème espace et un fraisier" />
          </div>
        </section>

        <section id="fonctionnalites" className="conteneur" style={{ paddingBottom: 40 }}>
          <div className="titre-section"><h2>Tout au même endroit</h2></div>
          <div className="grille-3">
            {FONCTIONS.map((f) => (
              <div key={f.titre} className="carte">
                <span className="rond-icone" style={{ width: 52, height: 52, margin: "0 0 12px" }}>{f.icone}</span>
                <h3>{f.titre}</h3>
                <p className="doux" style={{ margin: 0 }}>{f.texte}</p>
              </div>
            ))}
          </div>
          <div className="centre" style={{ marginTop: 32 }}>
            <Link href="/tarifs" className="btn btn-secondaire">Voir les tarifs</Link>
          </div>
        </section>
        <p className="pied">Atelier Sucré · version pilote</p>
      </main>
    </>
  );
}
