import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MiseEnPageAuth } from "../MiseEnPageAuth";
import { FormulaireInscription } from "./FormulaireInscription";

export const metadata: Metadata = { title: "Créer mon atelier" };

export default async function PageInscription() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/espace");

  return (
    <MiseEnPageAuth
      titre="Créer mon atelier"
      pied={
        <p className="doux">
          Déjà inscrite ou inscrit ? <Link href="/connexion">Se connecter</Link>
        </p>
      }
    >
      <p className="doux">Recevez les demandes de devis de vos clients Instagram au même endroit.</p>
      <FormulaireInscription />
    </MiseEnPageAuth>
  );
}
