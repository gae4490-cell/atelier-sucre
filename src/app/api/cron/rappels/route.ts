import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { envoyerEmail } from "@/lib/email";
import { emailGenerique } from "@/lib/email-templates";
import { env } from "@/lib/env";
import { ajouterJours, aujourdhuiA, formaterDateCourte } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tâche planifiée (Vercel Cron ou tout planificateur) — à appeler toutes les heures :
 *   GET /api/cron/rappels  avec l'en-tête  Authorization: Bearer $CRON_SECRET
 * Idempotente : chaque rappel a une clé de déduplication.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ erreur: "non autorisé" }, { status: 401 });
  }
  const admin = createAdminClient();
  const bilan = { reservations_liberees: 0, rappels_24h: 0, retraits_demain: 0 };

  const { data: lib } = await admin.rpc("liberer_reservations_expirees");
  bilan.reservations_liberees = Number(lib ?? 0);

  // 1. Demandes sans réponse depuis 24 h (offre Pro, option activée)
  const { data: anciennes } = await admin
    .from("demandes")
    .select("id, atelier_id, prenom, nb_parts, date_souhaitee, created_at")
    .eq("statut", "nouvelle")
    .is("rappel_envoye_le", null)
    .lt("created_at", new Date(Date.now() - 24 * 3600_000).toISOString())
    .gt("created_at", new Date(Date.now() - 14 * 86400_000).toISOString())
    .limit(200);
  for (const d of anciennes ?? []) {
    const [{ data: pro }, { data: reg }] = await Promise.all([
      admin.rpc("est_pro", { p_atelier: d.atelier_id }),
      admin.from("atelier_reglages").select("email_notifications, rappel_demande_24h").eq("atelier_id", d.atelier_id).single(),
    ]);
    await admin.from("demandes").update({ rappel_envoye_le: new Date().toISOString() }).eq("id", d.id);
    if (!pro || !reg?.rappel_demande_24h) continue;
    await admin.from("notifications").upsert(
      { atelier_id: d.atelier_id, demande_id: d.id, type: "rappel_24h", titre: `${d.prenom} attend votre réponse`, corps: "Demande reçue il y a plus de 24 h.", lien: `/espace/demandes/${d.id}`, dedupe_key: `rappel24h:${d.id}` },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
    await envoyerEmail({
      dedupeKey: `rappel24h:${d.id}`,
      type: "rappel_24h",
      atelierId: d.atelier_id,
      demandeId: d.id,
      to: reg.email_notifications,
      ...emailGenerique({
        sujet: `Rappel : ${d.prenom} attend votre réponse`,
        titre: "Une demande attend votre réponse",
        paragraphes: [`La demande de ${d.prenom} (${d.nb_parts} parts, ${formaterDateCourte(d.date_souhaitee)}) est sans réponse depuis plus de 24 heures.`],
        bouton: { libelle: "Répondre", url: `${env.siteUrl}/espace/demandes/${d.id}` },
      }),
    });
    bilan.rappels_24h++;
  }

  // 2. Retraits du lendemain (dans le fuseau de chaque atelier ; Europe/Paris par défaut)
  const demain = ajouterJours(aujourdhuiA("Europe/Paris"), 1);
  const { data: commandes } = await admin
    .from("commandes")
    .select("id, atelier_id, prenom, email, libelle, date_retrait, heure_retrait, lieu, mode")
    .in("statut", ["confirmee", "en_preparation", "prete"])
    .gte("date_retrait", ajouterJours(demain, -1))
    .lte("date_retrait", ajouterJours(demain, 1))
    .limit(500);
  for (const c of commandes ?? []) {
    const [{ data: a }, { data: reg }] = await Promise.all([
      admin.from("ateliers").select("nom, fuseau").eq("id", c.atelier_id).single(),
      admin.from("atelier_reglages").select("email_notifications, rappel_retrait_client, recap_quotidien").eq("atelier_id", c.atelier_id).single(),
    ]);
    if (!a || c.date_retrait !== ajouterJours(aujourdhuiA(a.fuseau), 1)) continue;
    const quand = `${formaterDateCourte(c.date_retrait)}${c.heure_retrait ? `, ${c.heure_retrait}` : ""}`;
    await admin.from("notifications").upsert(
      { atelier_id: c.atelier_id, type: "retrait_demain", titre: `Retrait demain : ${c.prenom}`, corps: `${c.libelle} · ${quand}`, lien: `/espace/commandes/${c.id}`, dedupe_key: `retrait:${c.id}:${c.date_retrait}` },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
    if (reg?.rappel_retrait_client) {
      await envoyerEmail({
        dedupeKey: `retrait:${c.id}:${c.date_retrait}:client`,
        type: "rappel_retrait_client",
        atelierId: c.atelier_id,
        demandeId: null,
        to: c.email,
        replyTo: reg.email_notifications,
        ...emailGenerique({
          sujet: `Rappel : ${c.mode === "livraison" ? "livraison" : "retrait"} demain — ${a.nom}`,
          titre: `À demain, ${c.prenom} !`,
          paragraphes: [`Votre commande « ${c.libelle} » vous attend demain.`],
          lignes: [["Quand", quand], ...(c.lieu ? ([["Où", c.lieu]] as [string, string][]) : [])],
        }),
      });
    }
    bilan.retraits_demain++;
  }

  return NextResponse.json(bilan);
}
