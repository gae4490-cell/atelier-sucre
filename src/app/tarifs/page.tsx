import type { Metadata } from "next";
import { EntetePublique } from "@/components/EntetePublique";
import { CartesOffres } from "@/components/CartesOffres";

export const metadata: Metadata = { title: "Tarifs" };

export default function Tarifs() {
  return (
    <>
      <EntetePublique actif="tarifs" />
      <main className="conteneur" style={{ paddingBottom: 40 }}>
        <h1 className="centre" style={{ marginTop: 20 }}>Choisissez votre offre</h1>
        <p className="centre doux" style={{ maxWidth: 560, margin: "0 auto 40px" }}>
          Tarifs de lancement indicatifs, sans engagement. Votre abonnement est distinct des paiements de vos clients, qui vous règlent leurs gâteaux.
        </p>
        <CartesOffres cta={(id) => ({ href: `/inscription?offre=${id}`, libelle: `Choisir ${id === "pro" ? "Pro" : "Essentiel"}` })} />
      </main>
    </>
  );
}
