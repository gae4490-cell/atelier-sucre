import { test } from "node:test";
import assert from "node:assert/strict";
import { eurosVersCentimes, formaterEuros, centimesVersSaisie, etatPaiement } from "../src/lib/argent.ts";
import { verifierSignatureStripe, signerStripe, encoderStripe } from "../src/lib/stripe-signature.ts";
import { genererJeton, hacherJeton, jetonPlausible } from "../src/lib/jetons.ts";

test("saisie des montants en euros -> centimes", () => {
  assert.equal(eurosVersCentimes("80"), 8000);
  assert.equal(eurosVersCentimes("25,5"), 2550);
  assert.equal(eurosVersCentimes("1 200 €"), 120000);
  assert.equal(eurosVersCentimes("0.07"), 7);
  assert.equal(eurosVersCentimes("-3"), null);
  assert.equal(eurosVersCentimes("12,345"), null);
  assert.equal(eurosVersCentimes("abc"), null);
  assert.equal(centimesVersSaisie(2500), "25");
  assert.equal(centimesVersSaisie(2550), "25,50");
});

test("affichage des montants", () => {
  assert.equal(formaterEuros(8000), "80 €");
  assert.equal(formaterEuros(5500), "55 €");
  assert.equal(formaterEuros(1850), "18,50 €");
});

test("statut de paiement du scénario Lina", () => {
  assert.equal(etatPaiement(8000, 2500, 0), "acompte_attendu");
  assert.equal(etatPaiement(8000, 2500, 2500), "acompte_recu");
  assert.equal(etatPaiement(8000, 2500, 8000), "paye");
  assert.equal(etatPaiement(8000, 0, 0), "solde_du");
  assert.equal(etatPaiement(1800, 0, 1800), "paye");
});

test("signature de webhook Stripe", () => {
  const secret = "whsec_test";
  const corps = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const t = 1_800_000_000;
  const entete = signerStripe(corps, secret, t);
  assert.equal(verifierSignatureStripe(corps, entete, secret, 300, t + 10), true);
  assert.equal(verifierSignatureStripe(corps + " ", entete, secret, 300, t + 10), false, "corps modifié");
  assert.equal(verifierSignatureStripe(corps, entete, "autre", 300, t + 10), false, "mauvais secret");
  assert.equal(verifierSignatureStripe(corps, entete, secret, 300, t + 1000), false, "rejeu trop tardif");
  assert.equal(verifierSignatureStripe(corps, null, secret), false);
  assert.equal(verifierSignatureStripe(corps, `t=${t},v1=deadbeef,` + entete.split(",")[1], secret, 300, t), true, "plusieurs signatures");
});

test("encodage des paramètres Stripe", () => {
  const s = encoderStripe({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: 2500, product_data: { name: "Acompte" } } }],
    metadata: { paiement_id: "abc" },
    vide: undefined,
  });
  assert.equal(
    decodeURIComponent(s),
    "mode=payment&line_items[0][quantity]=1&line_items[0][price_data][currency]=eur&line_items[0][price_data][unit_amount]=2500&line_items[0][price_data][product_data][name]=Acompte&metadata[paiement_id]=abc",
  );
});

test("jetons de liens privés", () => {
  const j = genererJeton();
  assert.ok(jetonPlausible(j));
  assert.notEqual(j, genererJeton());
  assert.equal(hacherJeton(j).length, 64);
  assert.equal(hacherJeton(j), hacherJeton(j));
  assert.equal(jetonPlausible("../../etc"), false);
});
