import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cheminSur } from "@/lib/navigation";
import { MiseEnPageAuth } from "../MiseEnPageAuth";
import { FormulaireConnexion } from "./FormulaireConnexion";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ suivant?: string; erreur?: string }>;
}) {
  const sp = await searchParams;
  const suivant = cheminSur(sp.suivant);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(suivant);

  return (
    <MiseEnPageAuth
      titre="Connexion"
      pied={
        <p className="doux">
          Pas encore de compte ? <Link href="/inscription">Créer mon atelier</Link>
        </p>
      }
    >
      {sp.erreur === "lien" && (
        <div className="alerte alerte-erreur" role="alert">
          Ce lien n&apos;est plus valide ou a déjà été utilisé. Connectez-vous ou demandez un nouveau lien.
        </div>
      )}
      <FormulaireConnexion suivant={suivant} />
    </MiseEnPageAuth>
  );
}
