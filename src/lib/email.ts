import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export interface EmailAEnvoyer {
  /** Clé unique : un même e-mail n'est jamais envoyé deux fois (relances techniques). */
  dedupeKey: string;
  type: string;
  atelierId: string | null;
  demandeId: string | null;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export type ResultatEmail = "envoye" | "simule" | "deja_envoye" | "echec";

/**
 * Envoie un e-mail transactionnel et l'inscrit dans l'historique (table emails).
 * Un échec n'interrompt jamais le parcours : il est journalisé et visible
 * dans la fiche de la demande.
 */
export async function envoyerEmail(e: EmailAEnvoyer): Promise<ResultatEmail> {
  const admin = createAdminClient();

  // 1. Réserver la clé (idempotence). Si elle existe déjà et a abouti, on s'arrête.
  await admin.from("emails").upsert(
    {
      dedupe_key: e.dedupeKey,
      type: e.type,
      atelier_id: e.atelierId,
      demande_id: e.demandeId,
      destinataire: e.to,
      sujet: e.subject,
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );
  const { data: ligne } = await admin
    .from("emails")
    .select("id, statut, tentatives")
    .eq("dedupe_key", e.dedupeKey)
    .single();
  if (!ligne) return "echec";
  if (ligne.statut === "envoye" || ligne.statut === "simule") return "deja_envoye";

  const tentatives = (ligne.tentatives ?? 0) + 1;

  // 2. Envoyer
  try {
    if (env.emailProvider === "console") {
      console.info(`[email simulé] à ${e.to} — ${e.subject}\n${e.text}`);
      await admin.from("emails").update({ statut: "simule", tentatives, erreur: null }).eq("id", ligne.id);
      return "simule";
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
        // Resend déduplique aussi de son côté pendant 24 h.
        "Idempotency-Key": e.dedupeKey.slice(0, 256),
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [e.to],
        subject: e.subject,
        html: e.html,
        text: e.text,
        ...(e.replyTo ? { reply_to: e.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const corps = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) throw new Error(corps.message ?? `HTTP ${res.status}`);

    await admin
      .from("emails")
      .update({ statut: "envoye", tentatives, erreur: null, fournisseur_id: corps.id ?? null })
      .eq("id", ligne.id);
    return "envoye";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] échec ${e.type} vers ${e.to} : ${message}`);
    await admin
      .from("emails")
      .update({ statut: "echec", tentatives, erreur: message.slice(0, 500) })
      .eq("id", ligne.id);
    return "echec";
  }
}
