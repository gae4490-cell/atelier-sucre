import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { cheminSur } from "@/lib/navigation";

/**
 * Point d'arrivée des liens reçus par e-mail (vérification, réinitialisation).
 * - token_hash + type : fonctionne même si le lien est ouvert sur un autre appareil
 *   (gabarits d'e-mails Supabase recommandés dans docs/DEPLOIEMENT.md).
 * - code : flux PKCE par défaut de Supabase (même navigateur que l'inscription).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const suivant = cheminSur(searchParams.get("suivant") ?? searchParams.get("next"), "/espace");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(type === "recovery" ? "/reinitialiser-mot-de-passe" : suivant, origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(suivant, origin));
  }

  return NextResponse.redirect(new URL("/connexion?erreur=lien", origin));
}
