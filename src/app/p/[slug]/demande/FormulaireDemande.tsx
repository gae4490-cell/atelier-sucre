"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUDGETS, LIMITES, ajouterJours, formaterDateCourte, premiereDatePossible, validerDemande,
  type ContexteAtelier,
} from "@/lib/validation";
import { preparerImage, uuid } from "@/lib/image-client";
import {
  IcoCalendrier, IcoCheck, IcoChevronBas, IcoCroix, IcoEnvoi, IcoEpingle, IcoEtincelle, IcoFlecheDroite,
  IcoFlecheGauche, IcoGateau, IcoMail, IcoPart, IcoPersonnes, IcoPhoto, IcoPlus, IcoTelephone, IcoUtilisateur,
} from "@/components/icones";

type Valeurs = {
  date_souhaitee: string;
  nb_parts: string;
  type_evenement: string;
  mode: string;
  adresse_livraison: string;
  theme: string;
  parfum: string;
  budget_indicatif: string;
  message: string;
  prenom: string;
  email: string;
  telephone: string;
};

const VIDE: Valeurs = {
  date_souhaitee: "", nb_parts: "", type_evenement: "", mode: "", adresse_livraison: "",
  theme: "", parfum: "", budget_indicatif: "", message: "", prenom: "", email: "", telephone: "",
};

const CHAMPS_ETAPE: (keyof Valeurs)[][] = [
  ["date_souhaitee", "nb_parts", "type_evenement", "mode", "adresse_livraison"],
  ["theme", "parfum", "budget_indicatif", "message"],
  ["prenom", "email", "telephone"],
];
const NOMS_ETAPES = ["Votre projet", "Les détails", "Envoi"];

interface Options {
  typesEvenement: string[];
  parfums: string[];
  retraitActif: boolean;
  livraisonActive: boolean;
  zoneRetrait: string | null;
  livraisonNote: string | null;
}

export function FormulaireDemande({
  slug, nomAtelier, apercu, options, ctx, gateau, source,
}: {
  gateau: { code: string; titre: string; prix: string | null; photo: string | null } | null;
  source: string;
  slug: string;
  nomAtelier: string;
  apercu: boolean;
  options: Options;
  ctx: ContexteAtelier;
}) {
  const router = useRouter();
  const cleBrouillon = `atelier-sucre:demande:${slug}`;
  const [etape, setEtape] = useState(0);
  const [v, setV] = useState<Valeurs>(() => ({
    ...VIDE,
    mode: options.retraitActif && !options.livraisonActive ? "retrait" : !options.retraitActif && options.livraisonActive ? "livraison" : "",
  }));
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [cle, setCle] = useState("");
  const [quota, setQuota] = useState<string | null>(null);
  const ouvertA = useRef(Date.now());
  const pot = useRef<HTMLInputElement>(null);
  const charge = useRef(false);
  const titre = useRef<HTMLHeadingElement>(null);

  // Reprise après actualisation (hors photo) — stockage de session, sans planter si indisponible.
  useEffect(() => {
    try {
      const brut = sessionStorage.getItem(cleBrouillon);
      if (brut) {
        const b = JSON.parse(brut) as { v?: Partial<Valeurs>; etape?: number; cle?: string };
        if (b.v) setV((prev) => ({ ...prev, ...b.v }));
        if (typeof b.etape === "number" && b.etape >= 0 && b.etape <= 2) setEtape(b.etape);
        if (b.cle) setCle(b.cle);
        else setCle(uuid());
      } else setCle(uuid());
    } catch {
      setCle(uuid());
    }
    charge.current = true;
  }, [cleBrouillon]);

  useEffect(() => {
    if (!charge.current) return;
    try {
      sessionStorage.setItem(cleBrouillon, JSON.stringify({ v, etape, cle }));
    } catch {
      /* stockage indisponible : on continue sans brouillon */
    }
  }, [v, etape, cle, cleBrouillon]);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const min = premiereDatePossible(ctx);
  const max = ajouterJours(ctx.aujourdhui, LIMITES.joursMaxAvance);
  const prochainesBloquees = useMemo(
    () => ctx.datesBloquees.filter((d) => d >= min && d <= ajouterJours(ctx.aujourdhui, 90)).slice(0, 8),
    [ctx, min],
  );

  function maj<K extends keyof Valeurs>(champ: K, valeur: Valeurs[K]) {
    setV((p) => ({ ...p, [champ]: valeur }));
    if (erreurs[champ]) setErreurs((e) => { const c = { ...e }; delete c[champ]; return c; });
  }

  function erreursEtape(n: number, valeurs = v) {
    const r = validerDemande(valeurs, ctx);
    if (r.ok) return {};
    const e: Record<string, string> = {};
    for (const c of CHAMPS_ETAPE[n]) if (r.erreurs[c]) e[c] = r.erreurs[c];
    return e;
  }

  function allerA(n: number) {
    setEtape(n);
    setErreurGlobale(null);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      titre.current?.focus({ preventScroll: true });
    });
  }

  function suivant() {
    const e = erreursEtape(etape);
    setErreurs(e);
    if (Object.keys(e).length === 0) allerA(etape + 1);
    else document.querySelector<HTMLElement>(`[name="${Object.keys(e)[0]}"]`)?.focus();
  }

  async function choisirPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErreurs((x) => { const c = { ...x }; delete c.photo; return c; });
    setPhotoEnCours(true);
    try {
      const blob = await preparerImage(f);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      setErreurs((x) => ({ ...x, photo: err instanceof Error ? err.message : "Cette photo ne peut pas être utilisée." }));
    } finally {
      setPhotoEnCours(false);
    }
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (envoi || apercu) return;
    // Validation de toutes les étapes avant l'envoi
    for (let n = 0; n < 3; n++) {
      const er = erreursEtape(n);
      if (Object.keys(er).length) {
        setErreurs(er);
        if (n !== etape) allerA(n);
        return;
      }
    }
    setEnvoi(true);
    setErreurGlobale(null);
    try {
      const fd = new FormData();
      for (const [k, val] of Object.entries(v)) fd.append(k, val);
      fd.append("slug", slug);
      fd.append("cle", cle);
      fd.append("ouvert_a", String(ouvertA.current));
      fd.append("site_web", pot.current?.value ?? "");
      if (gateau) fd.append("pub", gateau.code);
      fd.append("src", source);
      if (photo) fd.append("photo", photo.blob, "inspiration.jpg");

      const res = await fetch("/api/demandes", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; numero?: number; erreur?: string; erreurs?: Record<string, string>; quota?: boolean; contact?: string | null };
      if (data.quota) {
        setQuota(data.contact ?? "");
        setEnvoi(false);
        return;
      }
      if (res.ok && data.ok) {
        try { sessionStorage.removeItem(cleBrouillon); } catch { /* rien */ }
        router.replace(`/p/${slug}/demande/envoyee${data.numero ? `?n=${data.numero}` : ""}`);
        return; // on garde le bouton désactivé pendant la navigation
      }
      if (data.erreurs && Object.keys(data.erreurs).length) {
        setErreurs(data.erreurs);
        const n = CHAMPS_ETAPE.findIndex((cs) => cs.some((c) => data.erreurs![c]));
        if (n >= 0 && n !== etape) allerA(n);
        if (data.erreurs.photo) allerA(1);
      }
      setErreurGlobale(data.erreur ?? "L'envoi n'a pas abouti. Vérifiez les informations et réessayez.");
    } catch {
      setErreurGlobale("Connexion impossible. Vérifiez votre réseau puis appuyez de nouveau sur « Envoyer ma demande » : votre demande ne sera pas envoyée en double.");
    }
    setEnvoi(false);
  }

  const err = (c: string) =>
    erreurs[c] ? <p className="erreur-champ" id={`err-${c}`} role="alert">{erreurs[c]}</p> : null;
  const aria = (c: string) => (erreurs[c] ? { "aria-invalid": true, "aria-describedby": `err-${c}` } : {});

  return (
    <main className="conteneur-etroit" style={{ paddingBottom: 40 }}>
      {apercu && (
        <div className="bandeau-apercu" style={{ margin: "0 -20px" }} role="status">
          Aperçu : la vitrine n&apos;est pas publiée, l&apos;envoi est désactivé.
        </div>
      )}
      <header className="rangee espace-entre" style={{ padding: "14px 0 4px", flexWrap: "nowrap" }}>
        {etape > 0 ? (
          <button type="button" className="btn btn-icone" style={{ background: "transparent", color: "var(--prune)" }} onClick={() => allerA(etape - 1)} aria-label="Étape précédente">
            <IcoFlecheGauche taille={24} />
          </button>
        ) : (
          <Link href={`/p/${slug}`} className="btn btn-icone" style={{ color: "var(--prune)" }} aria-label="Retour à la vitrine">
            <IcoFlecheGauche taille={24} />
          </Link>
        )}
        <span className="serif" style={{ fontSize: "1.3rem", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomAtelier}</span>
        <span style={{ width: 44, flex: "none" }} />
      </header>

      <ol className="etapes" aria-label="Étapes de la demande" style={{ padding: 0 }}>
        {NOMS_ETAPES.map((nom, i) => (
          <li key={nom} className={`etape ${i < etape ? "faite" : i === etape ? "active" : ""}`} aria-current={i === etape ? "step" : undefined} style={{ listStyle: "none" }}>
            <span className="pastille">{i < etape ? <IcoCheck taille={16} /> : i + 1}</span>
            {nom}
          </li>
        ))}
      </ol>

      <h1 ref={titre} tabIndex={-1} style={{ fontSize: "2.1rem", outline: "none" }}>
        {etape === 0 && <>Votre gâteau<br />sur mesure</>}
        {etape === 1 && <>Les détails</>}
        {etape === 2 && <>Vos coordonnées</>}
      </h1>

      {gateau && (
        <div className="carte-plate rangee" style={{ flexWrap: "nowrap", marginBottom: 14 }}>
          <div className="photo" style={{ width: 64, height: 64, flex: "none" }}>{gateau.photo ? <img src={gateau.photo} alt="" /> : <IcoGateau />}</div>
          <div><span className="petit doux">Gâteau sélectionné</span><br /><strong>{gateau.titre}</strong>{gateau.prix && <span className="doux"> · dès {gateau.prix}</span>}</div>
        </div>
      )}
      {quota !== null && (
        <div className="alerte alerte-ambre" role="alert" style={{ flexDirection: "column" }}>
          <strong>Votre demande n&apos;a pas été transmise.</strong>
          <span>{nomAtelier} ne peut plus recevoir de nouvelles demandes en ligne ce mois-ci.{quota ? ` Contactez directement l'atelier : ${quota}` : " Contactez directement l'atelier, par exemple sur Instagram."}</span>
        </div>
      )}
      {erreurGlobale && <div className="alerte alerte-erreur" role="alert">{erreurGlobale}</div>}

      <form onSubmit={envoyer} noValidate>
        {/* Piège à robots : invisible pour les humains */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
          <label>Site web<input ref={pot} type="text" name="site_web" tabIndex={-1} autoComplete="off" /></label>
        </div>

        {etape === 0 && (
          <>
            <label className="champ">
              <span className="etiquette">Date souhaitée <span className="requis">*</span></span>
              <span className={`saisie ${erreurs.date_souhaitee ? "invalide" : ""}`}>
                <IcoCalendrier />
                <input type="date" name="date_souhaitee" min={min} max={max} value={v.date_souhaitee} onChange={(e) => maj("date_souhaitee", e.target.value)} required {...aria("date_souhaitee")} />
              </span>
              {err("date_souhaitee")}
              {!erreurs.date_souhaitee && v.date_souhaitee && <p className="aide">{formaterDateCourte(v.date_souhaitee)}</p>}
              {ctx.delaiMinJours > 0 && <p className="aide">Délai minimum : {ctx.delaiMinJours} jour{ctx.delaiMinJours > 1 ? "s" : ""} (à partir du {formaterDateCourte(min)}).</p>}
              {prochainesBloquees.length > 0 && (
                <p className="aide">Indisponible : {prochainesBloquees.map((d) => formaterDateCourte(d).replace(/ \d{4}$/, "")).join(", ")}.</p>
              )}
            </label>

            <label className="champ">
              <span className="etiquette">Nombre de parts <span className="requis">*</span></span>
              <span className={`saisie ${erreurs.nb_parts ? "invalide" : ""}`}>
                <IcoPersonnes />
                <input type="number" name="nb_parts" inputMode="numeric" min={1} max={500} placeholder="15" value={v.nb_parts} onChange={(e) => maj("nb_parts", e.target.value)} required {...aria("nb_parts")} />
                <span className="prefixe">parts</span>
              </span>
              {err("nb_parts")}
            </label>

            {options.typesEvenement.length > 0 && (
              <label className="champ">
                <span className="etiquette">Type d&apos;événement</span>
                <span className="saisie">
                  <IcoEtincelle />
                  <select name="type_evenement" value={v.type_evenement} onChange={(e) => maj("type_evenement", e.target.value)}>
                    <option value="">Choisir…</option>
                    {options.typesEvenement.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <IcoChevronBas />
                </span>
              </label>
            )}

            {options.retraitActif && options.livraisonActive ? (
              <fieldset className="champ" style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
                <legend className="etiquette" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--texte-doux)", margin: "0 0 6px 4px" }}>
                  Retrait ou livraison <span className="requis">*</span>
                </legend>
                <div className="choix-groupe">
                  <label className="choix"><input type="radio" name="mode" value="retrait" checked={v.mode === "retrait"} onChange={() => maj("mode", "retrait")} /> <IcoEpingle /> Retrait</label>
                  <label className="choix"><input type="radio" name="mode" value="livraison" checked={v.mode === "livraison"} onChange={() => maj("mode", "livraison")} /> <IcoGateau /> Livraison</label>
                </div>
                {err("mode")}
              </fieldset>
            ) : (
              <p className="carte-plate petit" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <IcoEpingle /> {options.retraitActif ? `Retrait sur place${options.zoneRetrait ? ` — ${options.zoneRetrait}` : ""}` : "Livraison"}
              </p>
            )}
            {v.mode === "retrait" && options.zoneRetrait && options.livraisonActive && <p className="aide" style={{ marginTop: -6 }}>Retrait : {options.zoneRetrait}</p>}
            {v.mode === "livraison" && (
              <label className="champ">
                <span className="etiquette">Adresse ou ville de livraison <span className="requis">*</span></span>
                <span className={`saisie ${erreurs.adresse_livraison ? "invalide" : ""}`}>
                  <IcoEpingle />
                  <input name="adresse_livraison" maxLength={300} autoComplete="street-address" value={v.adresse_livraison} onChange={(e) => maj("adresse_livraison", e.target.value)} {...aria("adresse_livraison")} />
                </span>
                {err("adresse_livraison")}
                {options.livraisonNote && <p className="aide">{options.livraisonNote}</p>}
              </label>
            )}
          </>
        )}

        {etape === 1 && (
          <>
            <label className="champ">
              <span className="etiquette">Thème</span>
              <span className="saisie">
                <IcoEtincelle />
                <input name="theme" maxLength={120} placeholder="Espace, licorne, fleurs…" value={v.theme} onChange={(e) => maj("theme", e.target.value)} />
              </span>
            </label>
            <label className="champ">
              <span className="etiquette">Saveur principale</span>
              <span className="saisie">
                <IcoPart />
                {options.parfums.length > 0 ? (
                  <select name="parfum" value={v.parfum} onChange={(e) => maj("parfum", e.target.value)}>
                    <option value="">Choisir…</option>
                    {options.parfums.map((p) => <option key={p}>{p}</option>)}
                    <option value="À discuter">À discuter</option>
                  </select>
                ) : (
                  <input name="parfum" maxLength={60} value={v.parfum} onChange={(e) => maj("parfum", e.target.value)} />
                )}
                {options.parfums.length > 0 && <IcoChevronBas />}
              </span>
            </label>
            <label className="champ">
              <span className="etiquette">Budget indicatif</span>
              <span className="saisie">
                <span className="prefixe" aria-hidden="true" style={{ width: 20, textAlign: "center" }}>€</span>
                <select name="budget_indicatif" value={v.budget_indicatif} onChange={(e) => maj("budget_indicatif", e.target.value)}>
                  <option value="">Choisir…</option>
                  {BUDGETS.map((b) => <option key={b}>{b}</option>)}
                </select>
                <IcoChevronBas />
              </span>
            </label>

            <div className="champ carte-plate">
              <span className="etiquette" style={{ display: "flex", gap: 8, alignItems: "center", margin: "0 0 12px" }}>
                <IcoPhoto /> Photo d&apos;inspiration <span style={{ color: "var(--prune-clair)", fontWeight: 500 }}>(facultatif)</span>
              </span>
              <div className="vignettes-photo">
                {photo && (
                  <div className="vignette-photo">
                    <img src={photo.url} alt="Votre photo d'inspiration" />
                    <button type="button" className="retirer" onClick={() => setPhoto(null)} aria-label="Retirer la photo"><IcoCroix taille={16} /></button>
                  </div>
                )}
                {!photo && (
                  <label className="ajout-photo">
                    {photoEnCours ? <span className="spinner" style={{ borderTopColor: "var(--prune)" }} /> : <IcoPlus taille={28} />}
                    {photoEnCours ? "Préparation…" : "Ajouter une photo"}
                    <input type="file" accept="image/*" hidden onChange={choisirPhoto} disabled={photoEnCours} />
                  </label>
                )}
              </div>
              {err("photo")}
            </div>

            <label className="champ">
              <span className="etiquette">Votre message</span>
              <span className="saisie">
                <textarea name="message" maxLength={LIMITES.message} placeholder="Couleurs, prénom à écrire, allergies, idées…" value={v.message} onChange={(e) => maj("message", e.target.value)} />
              </span>
            </label>
          </>
        )}

        {etape === 2 && (
          <>
            <label className="champ">
              <span className="etiquette">Prénom <span className="requis">*</span></span>
              <span className={`saisie ${erreurs.prenom ? "invalide" : ""}`}>
                <IcoUtilisateur />
                <input name="prenom" autoComplete="given-name" maxLength={60} value={v.prenom} onChange={(e) => maj("prenom", e.target.value)} {...aria("prenom")} />
              </span>
              {err("prenom")}
            </label>
            <label className="champ">
              <span className="etiquette">E-mail <span className="requis">*</span></span>
              <span className={`saisie ${erreurs.email ? "invalide" : ""}`}>
                <IcoMail />
                <input name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" maxLength={254} value={v.email} onChange={(e) => maj("email", e.target.value)} {...aria("email")} />
              </span>
              {err("email")}
              <p className="aide">Vous y recevrez le récapitulatif de votre demande.</p>
            </label>
            <label className="champ">
              <span className="etiquette">Téléphone <span className="requis">*</span></span>
              <span className={`saisie ${erreurs.telephone ? "invalide" : ""}`}>
                <IcoTelephone />
                <input name="telephone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="06 12 34 56 78" value={v.telephone} onChange={(e) => maj("telephone", e.target.value)} {...aria("telephone")} />
              </span>
              {err("telephone")}
              <p className="aide">Le pâtissier pourra vous répondre par WhatsApp.</p>
            </label>

            <div className="carte-rose" style={{ margin: "6px 0 16px" }}>
              <p style={{ fontWeight: 600, margin: "0 0 6px" }}>Récapitulatif</p>
              <dl className="liste-def petit">
                <dt>Date</dt><dd>{v.date_souhaitee ? formaterDateCourte(v.date_souhaitee) : "—"}</dd>
                <dt>Parts</dt><dd>{v.nb_parts || "—"}</dd>
                {v.type_evenement && (<><dt>Événement</dt><dd>{v.type_evenement}</dd></>)}
                {v.theme && (<><dt>Thème</dt><dd>{v.theme}</dd></>)}
                {v.parfum && (<><dt>Saveur</dt><dd>{v.parfum}</dd></>)}
                <dt>Mode</dt><dd>{v.mode === "livraison" ? `Livraison — ${v.adresse_livraison}` : "Retrait"}</dd>
                {photo && (<><dt>Photo</dt><dd>Jointe</dd></>)}
              </dl>
            </div>
            <p className="aide" style={{ marginBottom: 14 }}>
              Vos coordonnées sont transmises uniquement à {nomAtelier} pour répondre à votre demande.
            </p>
          </>
        )}

        {etape < 2 ? (
          <button type="button" className="btn btn-primaire btn-large" onClick={suivant} disabled={photoEnCours}>
            Continuer <IcoFlecheDroite />
          </button>
        ) : (
          <button type="submit" className="btn btn-primaire btn-large" disabled={envoi || apercu || !cle} aria-busy={envoi}>
            {envoi ? <><span className="spinner" /> Envoi en cours…</> : <><IcoEnvoi /> Envoyer ma demande</>}
          </button>
        )}
      </form>
    </main>
  );
}
