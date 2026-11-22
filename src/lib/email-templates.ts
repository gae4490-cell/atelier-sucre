// Gabarits d'e-mails (HTML simple compatible avec la plupart des messageries + texte brut).

const PRUNE = "#6B1F3F";
const CREME = "#FBF5EF";
const ROSE = "#F4DCE0";

function echapper(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function gabarit(titre: string, contenu: string, bouton?: { libelle: string; url: string }) {
  const btn = bouton
    ? `<p style="margin:28px 0 8px"><a href="${echapper(bouton.url)}" style="background:${PRUNE};color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:600;display:inline-block">${echapper(bouton.libelle)}</a></p>`
    : "";
  return `<!doctype html><html lang="fr"><body style="margin:0;background:${CREME};font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#3a2230">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREME};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;padding:32px">
<tr><td>
<p style="font-family:Georgia,serif;font-size:22px;color:${PRUNE};margin:0 0 20px">Atelier Sucré</p>
<h1 style="font-family:Georgia,serif;font-size:26px;line-height:1.2;color:${PRUNE};margin:0 0 16px">${echapper(titre)}</h1>
${contenu}${btn}
</td></tr></table>
<p style="font-size:12px;color:#8a6f7c;margin-top:16px">Cet e-mail a été envoyé via Atelier Sucré.</p>
</td></tr></table></body></html>`;
}

export interface ResumeDemande {
  numero: number;
  prenom: string;
  email: string;
  telephoneLisible: string;
  dateLisible: string;
  nbParts: number;
  typeEvenement: string | null;
  theme: string | null;
  parfum: string | null;
  budget: string | null;
  mode: "retrait" | "livraison";
  adresse: string | null;
  message: string | null;
  avecPhoto: boolean;
}

function lignes(d: ResumeDemande): [string, string][] {
  const l: [string, string][] = [
    ["Date souhaitée", d.dateLisible],
    ["Nombre de parts", String(d.nbParts)],
  ];
  if (d.typeEvenement) l.push(["Événement", d.typeEvenement]);
  if (d.theme) l.push(["Thème", d.theme]);
  if (d.parfum) l.push(["Parfum", d.parfum]);
  if (d.budget) l.push(["Budget indicatif", d.budget]);
  l.push(["Mode", d.mode === "retrait" ? "Retrait" : `Livraison${d.adresse ? ` — ${d.adresse}` : ""}`]);
  if (d.avecPhoto) l.push(["Photo d'inspiration", "Jointe"]);
  return l;
}

function tableau(l: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ROSE}33;border-radius:14px;padding:6px 14px;margin:8px 0">${l
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#8a6f7c;font-size:14px;width:45%">${echapper(k)}</td><td style="padding:8px 0;font-size:15px;font-weight:600">${echapper(v)}</td></tr>`,
    )
    .join("")}</table>`;
}

function texte(l: [string, string][]): string {
  return l.map(([k, v]) => `- ${k} : ${v}`).join("\n");
}

/** Confirmation envoyée au client après sa demande. */
export function emailConfirmationClient(d: ResumeDemande, nomAtelier: string) {
  const sujet = `Votre demande de devis à ${nomAtelier} a bien été envoyée`;
  const intro = `Bonjour ${d.prenom}, votre demande n° ${d.numero} a bien été transmise à ${nomAtelier}.`;
  const attente = "Le pâtissier doit encore confirmer votre commande. Vous recevrez une réponse ou un devis prochainement.";
  const html = gabarit(
    "Demande envoyée",
    `<p style="font-size:15px;line-height:1.55">${echapper(intro)}</p>
     <p style="font-size:15px;line-height:1.55;background:${ROSE};border-radius:12px;padding:12px 14px"><strong>${echapper(attente)}</strong></p>
     ${tableau(lignes(d))}
     ${d.message ? `<p style="font-size:14px;color:#5b3c4a;white-space:pre-line">« ${echapper(d.message)} »</p>` : ""}`,
  );
  const text = `${intro}\n\n${attente}\n\nRécapitulatif :\n${texte(lignes(d))}${d.message ? `\n\nVotre message : ${d.message}` : ""}\n`;
  return { subject: sujet, html, text };
}

/** Alerte envoyée au pâtissier avec un lien direct vers la fiche. */
export function emailNouvelleDemandePatissier(d: ResumeDemande, lienFiche: string) {
  const projet = [d.theme && `thème ${d.theme}`, d.parfum].filter(Boolean).join(", ");
  const sujet = `Nouvelle demande de devis — ${d.prenom}, ${d.nbParts} parts, ${d.dateLisible}`;
  const contact: [string, string][] = [
    ["Client", d.prenom],
    ["E-mail", d.email],
    ["Téléphone", d.telephoneLisible],
  ];
  const html = gabarit(
    "Nouvelle demande de devis",
    `<p style="font-size:15px;line-height:1.55">${echapper(d.prenom)} vous a envoyé une demande${projet ? ` (${echapper(projet)})` : ""}.</p>
     ${tableau([...contact, ...lignes(d)])}
     ${d.message ? `<p style="font-size:14px;color:#5b3c4a;white-space:pre-line">« ${echapper(d.message)} »</p>` : ""}`,
    { libelle: "Voir la demande", url: lienFiche },
  );
  const text = `${d.prenom} vous a envoyé une demande de devis.\n\n${texte([...contact, ...lignes(d)])}${d.message ? `\n\nMessage : ${d.message}` : ""}\n\nVoir la demande : ${lienFiche}\n`;
  return { subject: sujet, html, text };
}

/** E-mail générique : titre, paragraphes, tableau de lignes et bouton facultatifs. */
export function emailGenerique(o: {
  sujet: string;
  titre: string;
  paragraphes: string[];
  lignes?: [string, string][];
  bouton?: { libelle: string; url: string };
}) {
  const html = gabarit(
    o.titre,
    o.paragraphes.map((p) => `<p style="font-size:15px;line-height:1.55">${echapper(p)}</p>`).join("") + (o.lignes?.length ? tableau(o.lignes) : ""),
    o.bouton,
  );
  const text = [
    ...o.paragraphes,
    ...(o.lignes?.length ? ["", texte(o.lignes)] : []),
    ...(o.bouton ? ["", `${o.bouton.libelle} : ${o.bouton.url}`] : []),
  ].join("\n");
  return { subject: o.sujet, html, text };
}
