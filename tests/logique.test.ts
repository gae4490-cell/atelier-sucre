import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validerDemande, verifierDate, normaliserTelephone, formaterTelephone, aujourdhuiA,
  ajouterJours, nettoyer, formaterDateCourte, type ContexteAtelier,
} from "../src/lib/validation.ts";
import { slugifier, verifierSlug } from "../src/lib/slug.ts";
import { lienWhatsApp, messageParDefaut } from "../src/lib/whatsapp.ts";
import { verifierImage } from "../src/lib/images.ts";

const ctx: ContexteAtelier = {
  aujourdhui: "2026-11-20",
  delaiMinJours: 3,
  datesBloquees: ["2026-12-05"],
  retraitActif: true,
  livraisonActive: false,
};

const lina = {
  prenom: "  Lina ",
  email: "Lina@Exemple.FR",
  telephone: "06 12 34 56 78",
  date_souhaitee: "2026-12-06",
  nb_parts: "15",
  type_evenement: "Anniversaire",
  theme: "Espace",
  parfum: "Chocolat",
  budget_indicatif: "50 à 80 €",
  message: "Une fusée\r\net des étoiles",
  mode: "retrait",
};

test("scénario Lina : demande valide et normalisée", () => {
  const r = validerDemande(lina, ctx);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.prenom, "Lina");
  assert.equal(r.data.email, "lina@exemple.fr");
  assert.equal(r.data.telephone, "33612345678");
  assert.equal(r.data.nb_parts, 15);
  assert.equal(r.data.message, "Une fusée\net des étoiles");
  assert.equal(r.data.adresse_livraison, null);
});

test("champs obligatoires manquants", () => {
  const r = validerDemande({}, ctx);
  assert.equal(r.ok, false);
  if (r.ok) return;
  for (const c of ["prenom", "email", "telephone", "date_souhaitee", "nb_parts"]) assert.ok(r.erreurs[c], c);
  // un seul mode proposé : retrait choisi d'office
  assert.equal(r.erreurs.mode, undefined);
});

test("date bloquée, délai minimum, date passée et trop lointaine refusés", () => {
  assert.match(verifierDate("2026-12-05", ctx)!, /pas disponible/);
  assert.match(verifierDate("2026-11-22", ctx)!, /3 jours de délai/);
  assert.equal(verifierDate("2026-11-23", ctx), null);
  assert.match(verifierDate("2026-11-19", { ...ctx, delaiMinJours: 0 })!, /passée/);
  assert.match(verifierDate("2027-12-01", ctx)!, /un an/);
  assert.match(verifierDate("2026-02-30", ctx)!, /valide/);
});

test("mode livraison : refusé si non proposé, adresse exigée sinon", () => {
  const r1 = validerDemande({ ...lina, mode: "livraison" }, ctx);
  assert.equal(r1.ok, false);
  const r2 = validerDemande({ ...lina, mode: "livraison" }, { ...ctx, livraisonActive: true });
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.ok(r2.erreurs.adresse_livraison);
  const r3 = validerDemande({ ...lina, mode: "livraison", adresse_livraison: "Lyon 3e" }, { ...ctx, livraisonActive: true });
  assert.equal(r3.ok, true);
});

test("nombre de parts hors bornes ou non numérique", () => {
  for (const v of ["0", "501", "abc", "1.5", "-3"]) {
    const r = validerDemande({ ...lina, nb_parts: v }, ctx);
    assert.equal(r.ok, false, v);
  }
});

test("téléphones", () => {
  assert.equal(normaliserTelephone("06.12.34.56.78"), "33612345678");
  assert.equal(normaliserTelephone("+33 6 12 34 56 78"), "33612345678");
  assert.equal(normaliserTelephone("+33 (0)6 12 34 56 78"), "33612345678");
  assert.equal(normaliserTelephone("0032 470 12 34 56"), "32470123456");
  assert.equal(normaliserTelephone("12"), null);
  assert.equal(formaterTelephone("33612345678"), "+33 6 12 34 56 78");
});

test("dates et fuseau Paris", () => {
  // 23h30 UTC le 31/12 = 0h30 le 1er janvier à Paris
  assert.equal(aujourdhuiA("Europe/Paris", new Date("2026-12-31T23:30:00Z")), "2027-01-01");
  assert.equal(ajouterJours("2026-02-27", 2), "2026-03-01");
  assert.equal(formaterDateCourte("2026-12-05"), "sam. 5 déc. 2026");
});

test("nettoyage des chaînes", () => {
  assert.equal(nettoyer("  a\u0000b   c ", 10), "a b c");
  assert.equal(nettoyer(42, 10), "");
  assert.equal(nettoyer("x".repeat(20), 5), "xxxxx");
});

test("slugs", () => {
  assert.equal(slugifier("Les Gâteaux de Lina !"), "les-gateaux-de-lina");
  assert.equal(slugifier("  Crème & Œufs  "), "creme-oeufs");
  assert.equal(verifierSlug("les-gateaux-de-lina"), null);
  assert.ok(verifierSlug("ab"));
  assert.ok(verifierSlug("-abc"));
  assert.ok(verifierSlug("a--b"));
  assert.ok(verifierSlug("espace"));
  assert.ok(verifierSlug("Majuscule"));
});

test("lien WhatsApp", () => {
  const msg = messageParDefaut({ prenom: "Lina", nomAtelier: "Atelier Sucré", dateLisible: "sam. 5 déc.", nbParts: 15, theme: "Espace" });
  assert.match(msg, /Bonjour Lina/);
  const url = lienWhatsApp("33612345678", msg);
  assert.ok(url.startsWith("https://wa.me/33612345678?text=Bonjour%20Lina"));
  assert.equal(decodeURIComponent(url.split("text=")[1]), msg);
});

test("images : détection par les octets", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const gif = new TextEncoder().encode("GIF89a.....");
  assert.deepEqual(verifierImage(jpeg), { ok: true, type: "image/jpeg" });
  assert.deepEqual(verifierImage(png), { ok: true, type: "image/png" });
  assert.deepEqual(verifierImage(webp), { ok: true, type: "image/webp" });
  assert.equal(verifierImage(gif).ok, false);
  assert.equal(verifierImage(new Uint8Array(0)).ok, false);
  const gros = new Uint8Array(5 * 1024 * 1024 + 1); gros.set(jpeg);
  assert.equal(verifierImage(gros).ok, false);
});
