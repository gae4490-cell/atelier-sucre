import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Client « service » : contourne RLS. À utiliser uniquement côté serveur,
 * pour des opérations précises et déjà validées (dépôt d'une demande publique,
 * journal des e-mails, limiteur de débit).
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
