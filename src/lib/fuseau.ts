// Conversions heure locale de l'atelier <-> instant UTC (créneaux de retrait), sans dépendance.

function decalageMinutes(instant: Date, fuseau: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const local = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return Math.round((local - instant.getTime()) / 60000);
}

/** « 2026-11-28 » + « 14:00 » à Paris -> ISO UTC. Null si invalide. */
export function localVersUtc(date: string, heure: string, fuseau = "Europe/Paris"): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(heure)) return null;
  const [a, m, j] = date.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  const naif = Date.UTC(a, m - 1, j, h, mi);
  let essai = naif - decalageMinutes(new Date(naif), fuseau) * 60000;
  essai = naif - decalageMinutes(new Date(essai), fuseau) * 60000; // ajustement aux changements d'heure
  const d = new Date(essai);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function heureLocale(iso: string, fuseau = "Europe/Paris"): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau, hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso))
    .replace(":", " h ");
}

export function jourLocal(iso: string, fuseau = "Europe/Paris"): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}

/** « samedi 28 novembre, 14 h 00 – 17 h 00 » */
export function libelleCreneau(debut: string, fin: string, fuseau = "Europe/Paris"): string {
  return `${jourLocal(debut, fuseau)}, ${heureLocale(debut, fuseau)} – ${heureLocale(fin, fuseau)}`;
}
