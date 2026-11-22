// Accès centralisé aux variables d'environnement, avec messages clairs si un réglage manque.

function requis(nom: string, valeur: string | undefined): string {
  if (!valeur) {
    throw new Error(
      `Variable d'environnement manquante : ${nom}. Copiez .env.example vers .env.local et renseignez-la.`,
    );
  }
  return valeur;
}

export const env = {
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  },
  get supabaseUrl() {
    return requis("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return requis("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get serviceRoleKey() {
    return requis("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get emailProvider(): "console" | "resend" {
    return process.env.EMAIL_PROVIDER === "resend" ? "resend" : "console";
  },
  get resendApiKey() {
    return requis("RESEND_API_KEY", process.env.RESEND_API_KEY);
  },
  get emailFrom() {
    return process.env.EMAIL_FROM ?? "Atelier Sucré <onboarding@resend.dev>";
  },
  get rateLimitSalt() {
    return process.env.RATE_LIMIT_SALT || "atelier-sucre-dev-salt";
  },
};
