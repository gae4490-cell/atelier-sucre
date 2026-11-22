"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { cheminSur } from "@/lib/navigation";
import { emailValide } from "@/lib/validation";

export type EtatAuth = { erreur?: string; succes?: string; email?: string; nonVerifie?: boolean } | null;

const MDP_MIN = 8;

function lireEmail(fd: FormData) {
  return String(fd.get("email") ?? "").trim().toLowerCase();
}

export async function connexion(_: EtatAuth, fd: FormData): Promise<EtatAuth> {
  const email = lireEmail(fd);
  const password = String(fd.get("password") ?? "");
  if (!emailValide(email) || !password) return { erreur: "Indiquez votre e-mail et votre mot de passe.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
      return { erreur: "Votre adresse e-mail n'est pas encore vérifiée. Cliquez sur le lien reçu par e-mail.", email, nonVerifie: true };
    }
    if (error.status === 429) return { erreur: "Trop de tentatives. Patientez quelques minutes.", email };
    return { erreur: "E-mail ou mot de passe incorrect.", email };
  }
  redirect(cheminSur(fd.get("suivant")));
}

export async function inscription(_: EtatAuth, fd: FormData): Promise<EtatAuth> {
  const email = lireEmail(fd);
  const password = String(fd.get("password") ?? "");
  if (!emailValide(email)) return { erreur: "Cette adresse e-mail semble incorrecte.", email };
  if (password.length < MDP_MIN) return { erreur: `Le mot de passe doit contenir au moins ${MDP_MIN} caractères.`, email };
  if (fd.get("cgu") !== "on") return { erreur: "Acceptez les conditions du pilote pour continuer.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${env.siteUrl}/auth/confirm?suivant=/bienvenue` },
  });
  if (error) {
    if (error.code === "weak_password") return { erreur: "Ce mot de passe est trop simple. Choisissez-en un plus long.", email };
    if (error.status === 429) return { erreur: "Trop de tentatives. Patientez quelques minutes.", email };
    return { erreur: "L'inscription n'a pas abouti. Réessayez dans un instant.", email };
  }
  // Si la vérification d'e-mail est désactivée dans Supabase, la session est déjà ouverte.
  if (data.session) redirect("/bienvenue");
  return {
    succes: `Un e-mail de vérification a été envoyé à ${email}. Ouvrez-le pour activer votre compte (pensez aux indésirables).`,
    email,
  };
}

export async function renvoyerVerification(_: EtatAuth, fd: FormData): Promise<EtatAuth> {
  const email = lireEmail(fd);
  if (!emailValide(email)) return { erreur: "Adresse e-mail incorrecte." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${env.siteUrl}/auth/confirm?suivant=/bienvenue` },
  });
  if (error?.status === 429) return { erreur: "Un e-mail vient déjà d'être envoyé. Patientez une minute.", email };
  return { succes: "Si un compte en attente existe pour cette adresse, un nouvel e-mail vient d'être envoyé.", email };
}

export async function motDePasseOublie(_: EtatAuth, fd: FormData): Promise<EtatAuth> {
  const email = lireEmail(fd);
  if (!emailValide(email)) return { erreur: "Cette adresse e-mail semble incorrecte.", email };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.siteUrl}/auth/confirm?suivant=/reinitialiser-mot-de-passe`,
  });
  // Réponse identique que le compte existe ou non.
  return { succes: "Si un compte existe pour cette adresse, vous allez recevoir un lien pour choisir un nouveau mot de passe.", email };
}

export async function nouveauMotDePasse(_: EtatAuth, fd: FormData): Promise<EtatAuth> {
  const password = String(fd.get("password") ?? "");
  const confirmation = String(fd.get("confirmation") ?? "");
  if (password.length < MDP_MIN) return { erreur: `Le mot de passe doit contenir au moins ${MDP_MIN} caractères.` };
  if (password !== confirmation) return { erreur: "Les deux mots de passe ne correspondent pas." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erreur: "Le lien a expiré. Demandez un nouveau lien de réinitialisation." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { erreur: "Choisissez un mot de passe différent de l'ancien." };
    return { erreur: "Le mot de passe n'a pas pu être modifié. Réessayez." };
  }
  redirect("/espace?mdp=ok");
}

export async function deconnexion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
