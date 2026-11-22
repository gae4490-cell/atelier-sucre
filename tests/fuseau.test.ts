import { test } from "node:test";
import assert from "node:assert/strict";
import { localVersUtc, libelleCreneau } from "../src/lib/fuseau.ts";

test("créneaux : heure de Paris vers UTC (hiver, été, changement d'heure)", () => {
  assert.equal(localVersUtc("2026-11-28", "14:00"), "2026-11-28T13:00:00.000Z");
  assert.equal(localVersUtc("2026-07-04", "14:00"), "2026-07-04T12:00:00.000Z");
  assert.equal(localVersUtc("2026-03-29", "10:00"), "2026-03-29T08:00:00.000Z"); // jour du passage à l'heure d'été
  assert.equal(localVersUtc("2026-11-28", "14:00", "America/Montreal"), "2026-11-28T19:00:00.000Z");
  assert.equal(localVersUtc("2026-11-28", "25:00"), null);
  assert.equal(localVersUtc("28/11/2026", "14:00"), null);
});

test("libellé de créneau", () => {
  assert.equal(libelleCreneau("2026-11-28T13:00:00Z", "2026-11-28T16:00:00Z"), "samedi 28 novembre, 14 h 00 – 17 h 00");
});
