"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  creerAtelier,
  enregistrerProfilBienvenue,
  majImage,
  publierDepuisBienvenue,
  verifierDisponibiliteLien,
} from "@/lib/actions-vitrine";
import { slugifier } from "@/lib/slug";
import { televerserImageVitrine } from "@/lib/televersement";
import { BoutonCopier, BoutonEnvoi, MessageEtat } from "@/components/ui";
import { Galerie } from "@/app/espace/vitrine/Formulaires";
import { IcoBoutique, IcoEpingle, IcoInstagram, IcoLien, IcoMail, IcoPhoto } from "@/components/icones";

export function EtapeCreation({ emailParDefaut }: { emailParDefaut: string }) {
  const [etat, action] = useActionState(creerAtelier, null);
  const [nom, setNom] = useState("");
  const [slug, setSlug] = useState("");
  const [slugModifie, setSlugModifie] = useState(false);
  const [dispo, setDispo] = useState<{ ok: boolean; message: string; suggestion?: string } | null>(null);
  const [site, setSite] = useState("");
  useEffect(() => setSite(window.location.host), []);

  const slugFinal = slugModifie ? slug : slugifier(nom);

  useEffect(() => {
    if (slugFinal.length < 3) {
      setDispo(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setDispo(await verifierDisponibiliteLien(slugFinal));
      } catch {
        setDispo(null);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [slugFinal]);

  return (
    <section>
      <h1 style={{ fontSize: "2rem" }}>Créons votre atelier</h1>
      <p className="doux">Ces informations apparaîtront sur votre vitrine. Vous pourrez les modifier à tout moment.</p>
      <MessageEtat etat={etat} />
      <form action={action}>
        <label className="champ">
          <span className="etiquette">Nom de l&apos;atelier <span className="requis">*</span></span>
          <span className="saisie">
            <IcoBoutique />
            <input name="nom" required minLength={2} maxLength={80} placeholder="Les gâteaux de Lina" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="organization" />
          </span>
        </label>
        <label className="champ">
          <span className="etiquette">Votre lien public <span className="requis">*</span></span>
          <span className={`saisie ${dispo && !dispo.ok ? "invalide" : ""}`}>
            <IcoLien />
            <span className="prefixe">{site}/p/</span>
            <input
              name="slug"
              required
              maxLength={48}
              value={slugFinal}
              onChange={(e) => {
                setSlugModifie(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
            />
          </span>
          {dispo && (
            <p className={dispo.ok ? "aide" : "erreur-champ"} style={dispo.ok ? { color: "var(--vert)" } : undefined} aria-live="polite">
              {dispo.message}
              {dispo.suggestion && (
                <> <button type="button" className="btn btn-fantome btn-petit" style={{ marginLeft: 6 }} onClick={() => { setSlugModifie(true); setSlug(dispo.suggestion!); }}>
                  Utiliser « {dispo.suggestion} »
                </button></>
              )}
            </p>
          )}
          <p className="aide">C&apos;est ce lien que vous mettrez dans votre bio Instagram.</p>
        </label>
        <label className="champ">
          <span className="etiquette">E-mail pour recevoir les demandes <span className="requis">*</span></span>
          <span className="saisie">
            <IcoMail />
            <input name="email_notifications" type="email" inputMode="email" required defaultValue={emailParDefaut} autoComplete="email" />
          </span>
        </label>
        <BoutonEnvoi enCours="Création…" disabled={dispo?.ok === false}>
          Continuer
        </BoutonEnvoi>
      </form>
    </section>
  );
}

export function ChoixPhoto({
  atelierId,
  champ,
  urlInitiale,
  libelle,
  rond = false,
}: {
  atelierId: string;
  champ: "logo_path" | "couverture_path";
  urlInitiale: string | null;
  libelle: string;
  rond?: boolean;
}) {
  const [url, setUrl] = useState(urlInitiale);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function choisir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErreur(null);
    demarrer(async () => {
      try {
        const chemin = await televerserImageVitrine(f, atelierId, champ === "logo_path" ? "logo" : "couverture");
        const r = await majImage(champ, chemin);
        if (r?.erreur) throw new Error(r.erreur);
        setUrl(URL.createObjectURL(f));
      } catch (err) {
        setErreur(err instanceof Error ? err.message : "L'envoi a échoué.");
      }
    });
  }

  return (
    <div className="champ">
      <span className="etiquette">{libelle}</span>
      <div className="rangee" style={{ alignItems: "center" }}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="photo"
          disabled={enCours}
          style={{
            width: rond ? 96 : 160,
            height: 96,
            borderRadius: rond ? "50%" : 14,
            border: "1.5px dashed var(--rose-2)",
            cursor: "pointer",
            padding: 0,
          }}
          aria-label={url ? `Changer : ${libelle}` : `Ajouter : ${libelle}`}
        >
          {url ? <img src={url} alt="" /> : <IcoPhoto taille={28} />}
        </button>
        <div>
          <button type="button" className="btn btn-fantome btn-petit" onClick={() => input.current?.click()} disabled={enCours}>
            {enCours ? <><span className="spinner" style={{ borderTopColor: "var(--prune)" }} /> Envoi…</> : url ? "Changer la photo" : "Ajouter une photo"}
          </button>
          <p className="aide">JPEG, PNG ou WebP · 5 Mo max</p>
        </div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/*" hidden onChange={choisir} />
      {erreur && <p className="erreur-champ" role="alert">{erreur}</p>}
    </div>
  );
}

export function EtapeProfil({
  atelierId,
  logoUrl,
  photos,
  valeurs,
}: {
  atelierId: string;
  logoUrl: string | null;
  photos: { id: string; url: string; titre: string | null; prix_indicatif: string | null }[];
  valeurs: { accroche: string; description: string; zone_retrait: string; instagram: string; ville: string; retrait_actif: boolean; livraison_active: boolean; delai_min_jours: number };
}) {
  const [etat, action] = useActionState(enregistrerProfilBienvenue, null);
  return (
    <section>
      <h1 style={{ fontSize: "2rem" }}>Votre vitrine</h1>
      <p className="doux">Logo, quelques photos et vos conditions de retrait. Tout est enregistré au fur et à mesure : vous pourrez reprendre plus tard.</p>
      <ChoixPhoto atelierId={atelierId} champ="logo_path" urlInitiale={logoUrl} libelle="Logo ou photo de profil" rond />
      <div className="champ">
        <span className="etiquette">Photos de vos créations</span>
        <Galerie atelierId={atelierId} photos={photos} />
      </div>
      <MessageEtat etat={etat} />
      <form action={action}>
        <label className="champ">
          <span className="etiquette">Phrase d&apos;accroche</span>
          <span className="saisie">
            <input name="accroche" maxLength={120} defaultValue={valeurs.accroche} placeholder="Vos gâteaux uniques, à votre image" />
          </span>
        </label>
        <label className="champ">
          <span className="etiquette">Présentation</span>
          <span className="saisie">
            <textarea name="description" maxLength={1500} defaultValue={valeurs.description} placeholder="Pâtissière à domicile, je réalise des gâteaux personnalisés pour vos anniversaires et événements…" />
          </span>
        </label>
        <label className="champ">
          <span className="etiquette">Ville <span className="requis">*</span></span>
          <span className="saisie"><IcoEpingle /><input name="ville" required maxLength={80} defaultValue={valeurs.ville} placeholder="Lyon" autoComplete="address-level2" /></span>
        </label>
        <label className="interrupteur"><span>Retrait sur place</span><input type="checkbox" name="retrait_actif" defaultChecked={valeurs.retrait_actif} /></label>
        <label className="interrupteur"><span>Livraison</span><input type="checkbox" name="livraison_active" defaultChecked={valeurs.livraison_active} /></label>
        <label className="champ" style={{ marginTop: 10 }}>
          <span className="etiquette">Délai minimum de commande</span>
          <span className="saisie"><input type="number" name="delai_min_jours" min={0} max={90} inputMode="numeric" defaultValue={valeurs.delai_min_jours} required /><span className="prefixe">jours</span></span>
        </label>
        <label className="champ">
          <span className="etiquette">Zone de retrait</span>
          <span className="saisie">
            <IcoEpingle />
            <input name="zone_retrait" maxLength={200} defaultValue={valeurs.zone_retrait} placeholder="Lyon 7e, près du métro Jean Macé" />
          </span>
        </label>
        <label className="champ">
          <span className="etiquette">Compte Instagram</span>
          <span className="saisie">
            <IcoInstagram />
            <span className="prefixe">@</span>
            <input name="instagram" maxLength={60} defaultValue={valeurs.instagram} placeholder="les.gateaux.de.lina" autoCapitalize="none" autoCorrect="off" />
          </span>
        </label>
        <BoutonEnvoi enCours="Enregistrement…">Continuer</BoutonEnvoi>
      </form>
    </section>
  );
}

export function EtapeApercu({ chemin }: { chemin: string }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h1 style={{ fontSize: "2rem" }}>Aperçu de votre vitrine</h1>
      <p className="doux">Voici ce que verront vos clients. <Link href="/bienvenue?etape=3">Modifier</Link> ou <Link href={chemin} target="_blank">ouvrir en plein écran</Link>.</p>
      <iframe src={chemin} title="Aperçu de la vitrine" style={{ width: "100%", height: 520, border: "8px solid var(--prune-fonce)", borderRadius: 30, background: "var(--creme)" }} />
    </section>
  );
}

export function EtapePublication({ lien, dejaPublie }: { lien: string; dejaPublie: boolean }) {
  const [etat, setEtat] = useState<{ erreur?: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  if (dejaPublie) {
    return (
      <section className="centre">
        <span className="rond-icone"><IcoLien taille={38} /></span>
        <h1 style={{ fontSize: "2rem" }}>Votre vitrine est en ligne</h1>
        <div className="carte-rose" style={{ marginBottom: 16, textAlign: "left" }}>
          <p className="petit doux" style={{ margin: 0 }}>Votre lien</p>
          <p style={{ fontWeight: 600, overflowWrap: "anywhere", margin: "4px 0 12px" }}>{lien}</p>
          <BoutonCopier texte={`${lien}?src=instagram`} libelle="Copier mon lien Instagram" className="btn btn-primaire btn-large" />
        </div>
        <p className="doux petit">Collez-le dans votre bio Instagram (Modifier le profil › Liens).</p>
        <Link href="/espace" className="btn btn-secondaire btn-large">Aller à mon espace</Link>
      </section>
    );
  }
  return (
    <section>
      <h2 style={{ fontSize: "1.6rem" }}>Prête à publier ?</h2>
      <p className="doux">Une fois publiée, votre vitrine est accessible à tous via ce lien :</p>
      <p style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{lien}</p>
      <MessageEtat etat={etat} />
      <button
        className="btn btn-primaire btn-large"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            const r = await publierDepuisBienvenue();
            if (r?.erreur) setEtat(r);
          })
        }
      >
        {enCours ? <><span className="spinner" /> Publication…</> : "Publier ma vitrine"}
      </button>
    </section>
  );
}
