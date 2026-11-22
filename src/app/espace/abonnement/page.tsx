import type { Metadata } from "next";
import { EntetePublique } from "@/components/EntetePublique";
import { CartesOffres } from "@/components/CartesOffres";

export const metadata: Metadata = { title: "Tarifs" };

export default function Tarifs() {
  return (
    <>
      <EntetePublique actif="tarifs" />

      <main className="conteneur" style={{ paddingBottom: 40 }}>
        <h1 className="centre" style={{ marginTop: 20 }}>
          Choisissez votre offre
        </h1>

        <p
          className="centre doux"
          style={{ maxWidth: 560, margin: "0 auto 40px" }}
        >
          Créez votre compte gratuit sans carte bancaire et recevez jusqu’à
          5 demandes de devis par mois.
        </p>

        <CartesOffres
          cta={(id) => {
            switch (id) {
              case "gratuit":
                return {
                  href: "/inscription",
                  libelle: "Créer un compte gratuit",
                };
              case "essentiel":
                return {
                  href: "/inscription?offre=essentiel",
                  libelle: "Choisir Essentiel",
                };
              case "pro":
                return {
                  href: "/inscription?offre=pro",
                  libelle: "Choisir Pro",
                };
              default:
                return null;
            }
          }}
        />
      </main>
    </>
  );
}