// Données fictives pour les démonstrations Lina et Sarah, plus un atelier témoin (isolation).
// Usage : npm run seed   (lit .env.local ; nécessite SUPABASE_SERVICE_ROLE_KEY)
// Rejouable : ne recrée pas ce qui existe déjà.

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const MOT_DE_PASSE = process.env.DEMO_PASSWORD || "AtelierDemo2026!";

function jourPlus(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Prochain samedi (au moins dans 2 jours), heure de Paris convertie en UTC (approx. hiver/été gérée). */
function prochainSamedi(heure) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  const jour = d.toISOString().slice(0, 10);
  const essai = new Date(`${jour}T${heure}:00Z`);
  const local = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(essai);
  const decalage = Number(local) - essai.getUTCHours();
  return new Date(essai.getTime() - decalage * 3600_000).toISOString();
}

async function utilisateur(email) {
  for (let page = 1; page < 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u) return u;
    if (data.users.length < 200) break;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password: MOT_DE_PASSE, email_confirm: true });
  if (error) throw error;
  console.log(`  compte créé : ${email}`);
  return data.user;
}

async function atelier(user, champs, emailNotif) {
  const { data: membre } = await admin.from("atelier_membres").select("atelier_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (membre) {
    console.log("  ce compte a déjà un atelier : conservé tel quel");
    return { id: membre.atelier_id, nouveau: false };
  }
  const { data: existant } = await admin.from("ateliers").select("id").eq("slug", champs.slug).maybeSingle();
  if (existant) {
    console.log(`  atelier déjà présent : /p/${champs.slug}`);
    return { id: existant.id, nouveau: false };
  }
  const { data, error } = await admin.from("ateliers").insert(champs).select("id").single();
  if (error) throw error;
  await admin.from("atelier_membres").insert({ atelier_id: data.id, user_id: user.id, role: "proprietaire" });
  await admin.from("atelier_reglages").insert({ atelier_id: data.id, email_notifications: emailNotif });
  console.log(`  atelier créé : /p/${champs.slug}`);
  return { id: data.id, nouveau: true };
}

async function envoyerImage(atelierId, fichier, prefixe) {
  const octets = await readFile(new URL(`../public/images/${fichier}`, import.meta.url));
  const chemin = `${atelierId}/${prefixe}-${randomUUID()}.jpg`;
  const { error } = await admin.storage.from("vitrines").upload(chemin, octets, { contentType: "image/jpeg" });
  if (error) throw error;
  return chemin;
}

async function publication(atelierId, champs, fichier, creneaux = []) {
  const { data: pub, error } = await admin.from("publications").insert({ atelier_id: atelierId, ...champs, statut: "brouillon" }).select("id, code").single();
  if (error) throw error;
  const chemin = await envoyerImage(atelierId, fichier, "pub");
  await admin.from("publication_photos").insert({ publication_id: pub.id, atelier_id: atelierId, path: chemin, path_vignette: chemin, position: 0 });
  for (const c of creneaux) await admin.from("creneaux").insert({ publication_id: pub.id, atelier_id: atelierId, ...c });
  const { error: e2 } = await admin.from("publications").update({ statut: "publiee" }).eq("id", pub.id);
  if (e2) throw e2;
  return pub;
}

async function main() {
  console.log("Atelier de Sarah (démonstration, offre Pro simulée)");
  const sarah = await utilisateur("demo@atelier-sucre.test");
  const a = await atelier(
    sarah,
    {
      slug: "les-gateaux-de-sarah",
      nom: "Les gâteaux de Sarah",
      accroche: "Vos gâteaux uniques, à votre image",
      description: "Pâtisserie à domicile. Gâteaux d'anniversaire, layer cakes et créations sur mesure pour tous vos événements.",
      ville: "Lyon",
      zone_retrait: "Lyon 7e, près du métro Jean Macé",
      horaires_retrait: "Mercredi au samedi, 10 h – 18 h",
      instagram: "atelier.sucre",
      contact_public: "@atelier.sucre sur Instagram",
      retrait_actif: true,
      livraison_active: true,
      livraison_note: "Lyon et 15 km autour, à partir de 8 €",
      delai_min_jours: 3,
      afficher_tarifs: true,
      tarifs_note: "Gâteau 8 parts : à partir de 45 €\nGâteau 15 parts : à partir de 75 €",
      publie: true,
    },
    "demo@atelier-sucre.test",
  );

  if (a.nouveau) {
    await admin.from("abonnements").update({ offre: "pro", statut: "simule" }).eq("atelier_id", a.id);
    const couverture = await envoyerImage(a.id, "gateaux-accueil.jpg", "couverture");
    await admin.from("ateliers").update({ couverture_path: couverture }).eq("id", a.id);
    for (const [f, t, p] of [["fraisier.jpg", "Fraisier", "dès 45 €"], ["gateau-espace.jpg", "Gâteau espace", "dès 75 €"]]) {
      await admin.from("galerie").insert({ atelier_id: a.id, path: await envoyerImage(a.id, f, "galerie"), titre: t, prix_indicatif: p });
    }
    await admin.from("dates_bloquees").insert([
      { atelier_id: a.id, jour: jourPlus(10), motif: "Salon du gâteau" },
      { atelier_id: a.id, jour: jourPlus(11), motif: "Salon du gâteau" },
    ]);

    await publication(a.id, { type: "creation", titre: "Layer cake fraise", categorie: "Layer cake", description: "Génoise vanille, crème légère et fraises fraîches.", prix_cents: 4500 }, "fraisier.jpg");
    await publication(a.id, { type: "sur_commande", titre: "Gâteau thème espace", categorie: "Gâteau d'anniversaire", description: "Pâte à sucre bleu nuit, fusée, planètes et étoiles dorées. Parfum au choix.", prix_cents: 7500, disponibilite: "Sur commande, 5 jours à l'avance" }, "gateau-espace.jpg");
    const vente = await publication(
      a.id,
      { type: "vente_flash", titre: "12 box de cupcakes", categorie: "Cupcakes", description: "Box de 6 cupcakes chocolat et vanille, décor étoilé. (Photo de démonstration.)", prix_cents: 1800, stock_total: 12, max_par_client: 4, disponibilite: "Retrait samedi de 14 h à 17 h" },
      "gateau-etoiles.jpg",
      [{ debut: prochainSamedi("14:00"), fin: prochainSamedi("17:00") }],
    );
    console.log(`  vente flash : /g/${vente.code}`);

    const demandes = [
      { prenom: "Lina", email: "lina@exemple.test", telephone: "33612345678", date_souhaitee: jourPlus(14), nb_parts: 15, type_evenement: "Anniversaire", theme: "Espace", parfum: "Chocolat", budget_indicatif: "50 à 80 €", message: "Pour les 7 ans de mon fils : fusée, planètes et étoiles dorées.", mode: "retrait", statut: "nouvelle", source: "instagram" },
      { prenom: "Inès", email: "ines@exemple.test", telephone: "33711223344", date_souhaitee: jourPlus(21), nb_parts: 40, type_evenement: "Mariage", theme: "Fleurs blanches", parfum: "Vanille", budget_indicatif: "Plus de 200 €", mode: "livraison", adresse_livraison: "Villeurbanne", statut: "nouvelle", source: "decouvrir", lue_le: new Date().toISOString() },
      { prenom: "Sacha", email: "sacha@exemple.test", telephone: "33655443322", date_souhaitee: jourPlus(9), nb_parts: 20, type_evenement: "Baptême", theme: "Pastel", parfum: "Framboise", mode: "retrait", statut: "nouvelle", source: "inconnue" },
    ];
    for (const d of demandes) {
      const { data, error } = await admin.from("demandes").insert({ atelier_id: a.id, cle_idempotence: randomUUID(), ...d }).select("id").single();
      if (error) throw error;
      await admin.from("notifications").insert({
        atelier_id: a.id, demande_id: data.id, type: "nouvelle_demande", titre: `Nouvelle demande de ${d.prenom}`,
        corps: `${d.theme ? `Thème ${d.theme} · ` : ""}${d.nb_parts} parts`, lien: `/espace/demandes/${data.id}`, dedupe_key: `nouvelle_demande:${data.id}`,
        lue_le: d.lue_le ?? null,
      });
    }
    console.log("  3 demandes (dont Lina), 3 publications (dont la vente flash), 2 dates bloquées");
  }

  console.log("Atelier témoin (isolation, offre Essentiel)");
  const autre = await utilisateur("temoin@atelier-sucre.test");
  const b = await atelier(autre, { slug: "atelier-temoin", nom: "Atelier Témoin", ville: "Paris", publie: true }, "temoin@atelier-sucre.test");
  if (b.nouveau) {
    await admin.from("demandes").insert({
      atelier_id: b.id, cle_idempotence: randomUUID(), prenom: "Confidentiel", email: "secret@exemple.test",
      telephone: "33600000000", date_souhaitee: jourPlus(12), nb_parts: 6, mode: "retrait", theme: "Ne doit pas apparaître chez Sarah",
    });
  }

  console.log(`\nTerminé. Sarah : demo@atelier-sucre.test / ${MOT_DE_PASSE}`);
  console.log("Atelier témoin : temoin@atelier-sucre.test / même mot de passe");
}

main().catch((e) => {
  console.error("Échec :", e.message ?? e);
  process.exit(1);
});
