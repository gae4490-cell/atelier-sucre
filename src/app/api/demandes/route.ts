import { NextResponse, after, type NextRequest } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { aujourdhuiA, formaterDateCourte, formaterTelephone, validerDemande } from "@/lib/validation";
import { extensionPour, verifierImage } from "@/lib/images";
import { UUID_RE } from "@/lib/navigation";
import { envoyerEmail } from "@/lib/email";
import { emailConfirmationClient, emailNouvelleDemandePatissier, type ResumeDemande } from "@/lib/email-templates";
import { quotaDemandes } from "@/lib/acces";
import { sourceDepuis } from "@/lib/publications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TAILLE_REQUETE_MAX = 6 * 1024 * 1024;
const DELAI_HUMAIN_MS = 2500;

function json(status: number, corps: Record<string, unknown>) {
  return NextResponse.json(corps, { status, headers: { "Cache-Control": "no-store" } });
}

function ipDe(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "inconnue").trim();
}

export async function POST(req: NextRequest) {
  const longueur = Number(req.headers.get("content-length") ?? 0);
  if (longueur > TAILLE_REQUETE_MAX) {
    return json(413, { erreur: "La photo est trop lourde (5 Mo maximum).", erreurs: { photo: "La photo dépasse 5 Mo." } });
  }

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return json(400, { erreur: "Le formulaire n'a pas pu être lu. Réessayez." });
  }

  const admin = createAdminClient();
  const slug = String(fd.get("slug") ?? "");
  const cle = String(fd.get("cle") ?? "");
  if (!/^[a-z0-9-]{3,48}$/.test(slug) || !UUID_RE.test(cle)) return json(400, { erreur: "Demande invalide. Rechargez la page." });

  // --- Anti-abus ------------------------------------------------------------
  // 1) Piège à robots : on répond « OK » sans rien enregistrer.
  if (String(fd.get("site_web") ?? "").trim() !== "") return json(200, { ok: true });
  // 2) Formulaire rempli trop vite pour un humain.
  const ouvertA = Number(fd.get("ouvert_a"));
  if (Number.isFinite(ouvertA) && ouvertA > 0 && Date.now() - ouvertA < DELAI_HUMAIN_MS) {
    return json(400, { erreur: "Envoi trop rapide. Vérifiez votre demande puis réessayez." });
  }
  // 3) Limites de débit par appareil (IP hachée, jamais stockée en clair).
  const ipHash = createHash("sha256").update(env.rateLimitSalt + ipDe(req)).digest("hex").slice(0, 32);
  const [q1, q2] = await Promise.all([
    admin.rpc("consommer_quota", { p_cle: `demande:ip10m:${ipHash}`, p_max: 5, p_fenetre_secondes: 600 }),
    admin.rpc("consommer_quota", { p_cle: `demande:ipjour:${ipHash}`, p_max: 20, p_fenetre_secondes: 86400 }),
  ]);
  if (q1.error || q2.error) console.error("[demandes] limiteur indisponible", q1.error ?? q2.error);
  if (q1.data === false || q2.data === false) {
    return json(429, { erreur: "Trop de demandes envoyées depuis cet appareil. Réessayez un peu plus tard." });
  }

  // --- Atelier ----------------------------------------------------------------
  const { data: atelier } = await admin
    .from("ateliers")
    .select("id, slug, nom, publie, delai_min_jours, retrait_actif, livraison_active, fuseau, contact_public")
    .eq("slug", slug)
    .maybeSingle();
  if (!atelier || !atelier.publie) return json(404, { erreur: "Cette vitrine n'accepte pas de demandes pour le moment." });

  const q3 = await admin.rpc("consommer_quota", { p_cle: `demande:atelier:${atelier.id}`, p_max: 60, p_fenetre_secondes: 3600 });
  if (q3.data === false) return json(429, { erreur: "Le pâtissier reçoit beaucoup de demandes. Réessayez dans un moment." });

  // --- Idempotence : un double appui ou une relance réseau ne crée pas de doublon.
  const { data: existante } = await admin.from("demandes").select("numero, atelier_id").eq("cle_idempotence", cle).maybeSingle();
  if (existante) {
    return existante.atelier_id === atelier.id ? json(200, { ok: true, numero: existante.numero }) : json(400, { erreur: "Demande invalide. Rechargez la page." });
  }

  // --- Quota de l'offre (Essentiel : 30 nouvelles demandes par mois) -------------
  const quota = await quotaDemandes(atelier.id);
  if (quota.atteint) {
    const mois = aujourdhuiA(atelier.fuseau).slice(0, 7);
    await admin.from("notifications").upsert(
      {
        atelier_id: atelier.id,
        type: "quota_atteint",
        titre: "Limite de demandes atteinte",
        corps: `Vos clients ne peuvent plus envoyer de demande ce mois-ci (${quota.limite} avec l'offre Essentiel). Passez à Pro pour des demandes illimitées.`,
        lien: "/espace/abonnement?offre=pro",
        dedupe_key: `quota:${atelier.id}:${mois}`,
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
    return json(403, { quota: true, contact: atelier.contact_public, erreur: "Votre demande n'a pas été transmise." });
  }

  // --- Gâteau associé et provenance --------------------------------------------
  let publicationId: string | null = null;
  let titreGateau: string | null = null;
  const codePub = String(fd.get("pub") ?? "");
  if (/^[a-f0-9]{10}$/.test(codePub)) {
    const { data: pub } = await admin.from("publications").select("id, titre, atelier_id, statut").eq("code", codePub).maybeSingle();
    if (pub && pub.atelier_id === atelier.id && pub.statut !== "brouillon") {
      publicationId = pub.id;
      titreGateau = pub.titre;
    }
  }
  const source = sourceDepuis(fd.get("src"));

  // --- Validation ---------------------------------------------------------------
  const aujourdhui = aujourdhuiA(atelier.fuseau);
  const { data: bloquees } = await admin.from("dates_bloquees").select("jour").eq("atelier_id", atelier.id).gte("jour", aujourdhui);
  const resultat = validerDemande(
    {
      prenom: fd.get("prenom"),
      email: fd.get("email"),
      telephone: fd.get("telephone"),
      date_souhaitee: fd.get("date_souhaitee"),
      nb_parts: fd.get("nb_parts"),
      type_evenement: fd.get("type_evenement"),
      theme: fd.get("theme"),
      parfum: fd.get("parfum"),
      budget_indicatif: fd.get("budget_indicatif"),
      message: fd.get("message"),
      mode: fd.get("mode"),
      adresse_livraison: fd.get("adresse_livraison"),
    },
    {
      aujourdhui,
      delaiMinJours: atelier.delai_min_jours,
      datesBloquees: (bloquees ?? []).map((b) => b.jour as string),
      retraitActif: atelier.retrait_actif,
      livraisonActive: atelier.livraison_active,
    },
  );
  if (!resultat.ok) return json(400, { erreur: "Certaines informations sont à corriger.", erreurs: resultat.erreurs });

  // --- Photo (facultative) : contrôle des octets, stockage privé ----------------
  const id = randomUUID();
  let photoPath: string | null = null;
  const photo = fd.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const octets = new Uint8Array(await photo.arrayBuffer());
    const verif = verifierImage(octets);
    if (!verif.ok) return json(400, { erreur: verif.erreur, erreurs: { photo: verif.erreur } });
    photoPath = `${atelier.id}/${id}/${randomUUID()}.${extensionPour(verif.type)}`;
    const { error } = await admin.storage.from("inspirations").upload(photoPath, octets, { contentType: verif.type, upsert: false });
    if (error) {
      console.error("[demandes] envoi photo", error);
      return json(502, { erreur: "La photo n'a pas pu être enregistrée. Réessayez, ou envoyez la demande sans photo." });
    }
  }

  // --- Enregistrement --------------------------------------------------------------
  const d = resultat.data;
  const { data: demande, error: errInsert } = await admin
    .from("demandes")
    .insert({ id, atelier_id: atelier.id, ...d, photo_path: photoPath, cle_idempotence: cle, ip_hash: ipHash, publication_id: publicationId, source })
    .select("id, numero")
    .single();

  if (errInsert || !demande) {
    if (photoPath) await admin.storage.from("inspirations").remove([photoPath]);
    if (errInsert?.code === "23505") {
      const { data: e } = await admin.from("demandes").select("numero").eq("cle_idempotence", cle).maybeSingle();
      if (e) return json(200, { ok: true, numero: e.numero });
    }
    console.error("[demandes] insertion", errInsert);
    return json(500, { erreur: "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant." });
  }

  const dateLisible = formaterDateCourte(d.date_souhaitee);
  const lienFiche = `${env.siteUrl}/espace/demandes/${demande.id}`;

  // Alerte dans l'application (dédupliquée)
  const { error: errNotif } = await admin.from("notifications").upsert(
    {
      atelier_id: atelier.id,
      demande_id: demande.id,
      type: "nouvelle_demande",
      titre: `Nouvelle demande de ${d.prenom}`,
      corps: [titreGateau && `Gâteau : ${titreGateau}`, d.theme && `Thème ${d.theme}`, `${d.nb_parts} parts`, dateLisible].filter(Boolean).join(" · "),
      lien: `/espace/demandes/${demande.id}`,
      dedupe_key: `nouvelle_demande:${demande.id}`,
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );
  if (errNotif) console.error("[demandes] notification", errNotif);

  // E-mails après la réponse : le client n'attend pas l'envoi. Les échecs sont journalisés.
  after(async () => {
    const { data: reglages } = await admin.from("atelier_reglages").select("email_notifications").eq("atelier_id", atelier.id).single();
    const resume: ResumeDemande = {
      numero: demande.numero,
      prenom: d.prenom,
      email: d.email,
      telephoneLisible: formaterTelephone(d.telephone),
      dateLisible,
      nbParts: d.nb_parts,
      typeEvenement: d.type_evenement,
      theme: titreGateau ? [d.theme, `gâteau « ${titreGateau} »`].filter(Boolean).join(", ") : d.theme,
      parfum: d.parfum,
      budget: d.budget_indicatif,
      mode: d.mode,
      adresse: d.adresse_livraison,
      message: d.message,
      avecPhoto: !!photoPath,
    };
    const client = emailConfirmationClient(resume, atelier.nom);
    const envois: Promise<unknown>[] = [
      envoyerEmail({
        dedupeKey: `demande:${demande.id}:confirmation_client`,
        type: "confirmation_client",
        atelierId: atelier.id,
        demandeId: demande.id,
        to: d.email,
        ...client,
        replyTo: reglages?.email_notifications,
      }),
    ];
    if (reglages?.email_notifications) {
      const pat = emailNouvelleDemandePatissier(resume, lienFiche);
      envois.push(
        envoyerEmail({
          dedupeKey: `demande:${demande.id}:alerte_patissier`,
          type: "alerte_patissier",
          atelierId: atelier.id,
          demandeId: demande.id,
          to: reglages.email_notifications,
          ...pat,
          replyTo: d.email,
        }),
      );
    }
    await Promise.allSettled(envois);
  });

  return json(201, { ok: true, numero: demande.numero });
}
