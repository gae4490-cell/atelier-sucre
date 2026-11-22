"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  ajouterDateBloquee, ajouterPhotoGalerie, majFormulaire, majIdentite, majPhotoGalerie, majRetrait,
  publierVitrine, supprimerDateBloquee, supprimerPhotoGalerie,
} from "@/lib/actions-vitrine";
import { televerserImageVitrine } from "@/lib/televersement";
import { formaterDateCourte } from "@/lib/validation";
import { BoutonEnvoi, MessageEtat } from "@/components/ui";
import { IcoCroix, IcoInstagram, IcoLien, IcoPlus } from "@/components/icones";

type Etat = { erreur?: string; succes?: string } | null;

export function InterrupteurPublication({ publie }: { publie: boolean }) {
  const [etat, setEtat] = useState<Etat>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <>
      <label className="interrupteur" style={{ paddingTop: 0 }}>
        <span>
          <strong>{publie ? "Vitrine en ligne" : "Vitrine hors ligne"}</strong>
          <span className="doux petit" style={{ display: "block" }}>
            {publie ? "Vos clients peuvent envoyer des demandes." : "Seul vous pouvez la voir (aperçu)."}
          </span>
        </span>
        <input
          type="checkbox"
          checked={publie}
          disabled={enCours}
          onChange={(e) => {
            const valeur = e.target.checked;
            demarrer(async () => setEtat(await publierVitrine(valeur)));
          }}
          aria-label="Publier la vitrine"
        />
      </label>
      <MessageEtat etat={etat} />
    </>
  );
}

export function FormIdentite({ valeurs }: { valeurs: { nom: string; slug: string; accroche: string; description: string; instagram: string; ville: string; contact_public: string } }) {
  const [etat, action] = useActionState(majIdentite, null);
  return (
    <form action={action}>
      <label className="champ">
        <span className="etiquette">Nom commercial</span>
        <span className="saisie"><input name="nom" required maxLength={80} defaultValue={valeurs.nom} /></span>
      </label>
      <label className="champ">
        <span className="etiquette">Lien public</span>
        <span className="saisie"><IcoLien /><span className="prefixe">/p/</span><input name="slug" required maxLength={48} defaultValue={valeurs.slug} autoCapitalize="none" spellCheck={false} /></span>
        <p className="aide">Si vous le changez après publication, l&apos;ancien lien redirige automatiquement vers le nouveau.</p>
      </label>
      <label className="champ">
        <span className="etiquette">Phrase d&apos;accroche</span>
        <span className="saisie"><input name="accroche" maxLength={120} defaultValue={valeurs.accroche} /></span>
      </label>
      <label className="champ">
        <span className="etiquette">Présentation</span>
        <span className="saisie"><textarea name="description" maxLength={1500} defaultValue={valeurs.description} /></span>
      </label>
      <label className="champ">
        <span className="etiquette">Ville</span>
        <span className="saisie"><input name="ville" maxLength={80} defaultValue={valeurs.ville} placeholder="Lyon" /></span>
        <p className="aide">Utilisée par les filtres du fil « Découvrir ».</p>
      </label>
      <label className="champ">
        <span className="etiquette">Contact public (facultatif)</span>
        <span className="saisie"><input name="contact_public" maxLength={120} defaultValue={valeurs.contact_public} placeholder="06 12 34 56 78 ou @les.gateaux.de.sarah" /></span>
        <p className="aide">Affiché aux clients si une demande ne peut pas être transmise.</p>
      </label>
      <label className="champ">
        <span className="etiquette">Instagram</span>
        <span className="saisie"><IcoInstagram /><span className="prefixe">@</span><input name="instagram" maxLength={60} defaultValue={valeurs.instagram} autoCapitalize="none" /></span>
      </label>
      <MessageEtat etat={etat} />
      <BoutonEnvoi className="btn btn-primaire" enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
    </form>
  );
}

export function FormRetrait({
  valeurs,
}: {
  valeurs: { retrait_actif: boolean; livraison_active: boolean; zone_retrait: string; horaires_retrait: string; livraison_note: string; delai_min_jours: number };
}) {
  const [etat, action] = useActionState(majRetrait, null);
  return (
    <form action={action}>
      <label className="interrupteur"><span>Retrait sur place</span><input type="checkbox" name="retrait_actif" defaultChecked={valeurs.retrait_actif} /></label>
      <label className="champ" style={{ marginTop: 10 }}>
        <span className="etiquette">Zone de retrait</span>
        <span className="saisie"><input name="zone_retrait" maxLength={200} defaultValue={valeurs.zone_retrait} placeholder="Lyon 7e, près du métro Jean Macé" /></span>
      </label>
      <label className="champ">
        <span className="etiquette">Horaires de retrait</span>
        <span className="saisie"><textarea name="horaires_retrait" maxLength={300} rows={3} defaultValue={valeurs.horaires_retrait} placeholder={"Mercredi au samedi, 10 h – 18 h"} style={{ minHeight: 70 }} /></span>
      </label>
      <label className="interrupteur"><span>Livraison</span><input type="checkbox" name="livraison_active" defaultChecked={valeurs.livraison_active} /></label>
      <label className="champ" style={{ marginTop: 10 }}>
        <span className="etiquette">Conditions de livraison</span>
        <span className="saisie"><input name="livraison_note" maxLength={300} defaultValue={valeurs.livraison_note} placeholder="Lyon et 15 km autour, à partir de 8 €" /></span>
      </label>
      <label className="champ">
        <span className="etiquette">Délai minimum de commande</span>
        <span className="saisie"><input type="number" name="delai_min_jours" min={0} max={90} inputMode="numeric" defaultValue={valeurs.delai_min_jours} required /><span className="prefixe">jours</span></span>
      </label>
      <MessageEtat etat={etat} />
      <BoutonEnvoi className="btn btn-primaire" enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
    </form>
  );
}

export function FormFormulaire({
  valeurs,
}: {
  valeurs: { types_evenement: string; parfums: string; afficher_tarifs: boolean; tarifs_note: string };
}) {
  const [etat, action] = useActionState(majFormulaire, null);
  return (
    <form action={action}>
      <label className="champ">
        <span className="etiquette">Types d&apos;événement proposés (un par ligne)</span>
        <span className="saisie"><textarea name="types_evenement" rows={5} defaultValue={valeurs.types_evenement} /></span>
      </label>
      <label className="champ">
        <span className="etiquette">Parfums proposés (un par ligne)</span>
        <span className="saisie"><textarea name="parfums" rows={5} defaultValue={valeurs.parfums} /></span>
      </label>
      <label className="interrupteur"><span>Afficher les tarifs indicatifs sur la vitrine</span><input type="checkbox" name="afficher_tarifs" defaultChecked={valeurs.afficher_tarifs} /></label>
      <label className="champ" style={{ marginTop: 10 }}>
        <span className="etiquette">Tarifs indicatifs</span>
        <span className="saisie"><textarea name="tarifs_note" maxLength={800} defaultValue={valeurs.tarifs_note} placeholder={"Gâteau 8 parts : à partir de 45 €\nGâteau 15 parts : à partir de 75 €"} /></span>
      </label>
      <MessageEtat etat={etat} />
      <BoutonEnvoi className="btn btn-primaire" enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
    </form>
  );
}

type PhotoAffichee = { id: string; url: string; titre: string | null; prix_indicatif: string | null };

export function Galerie({ atelierId, photos }: { atelierId: string; photos: PhotoAffichee[] }) {
  const [etat, setEtat] = useState<Etat>(null);
  const [enCours, demarrer] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function ajouter(e: React.ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(e.target.files ?? []).slice(0, 6);
    e.target.value = "";
    if (!fichiers.length) return;
    setEtat(null);
    demarrer(async () => {
      let ajoutees = 0;
      for (const f of fichiers) {
        try {
          const chemin = await televerserImageVitrine(f, atelierId, "galerie");
          const r = await ajouterPhotoGalerie(chemin, "", "");
          if (r?.erreur) { setEtat(r); return; }
          ajoutees++;
        } catch (err) {
          setEtat({ erreur: err instanceof Error ? err.message : "L'envoi a échoué." });
          return;
        }
      }
      setEtat({ succes: ajoutees > 1 ? `${ajoutees} photos ajoutées.` : "Photo ajoutée." });
    });
  }

  return (
    <>
      <MessageEtat etat={etat} />
      <div className="pile">
        {photos.map((p) => <LignePhoto key={p.id} p={p} />)}
      </div>
      <button type="button" className="ajout-photo" style={{ width: "100%", height: 90, marginTop: 12 }} onClick={() => input.current?.click()} disabled={enCours}>
        {enCours ? <span className="spinner" style={{ borderTopColor: "var(--prune)" }} /> : <IcoPlus taille={26} />}
        {enCours ? "Envoi des photos…" : "Ajouter des photos (6 max à la fois)"}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/*" multiple hidden onChange={ajouter} />
    </>
  );
}

function LignePhoto({ p }: { p: PhotoAffichee }) {
  const [titre, setTitre] = useState(p.titre ?? "");
  const [prix, setPrix] = useState(p.prix_indicatif ?? "");
  const [etat, setEtat] = useState<Etat>(null);
  const [enCours, demarrer] = useTransition();
  const modifie = titre !== (p.titre ?? "") || prix !== (p.prix_indicatif ?? "");
  return (
    <div className="rangee" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
      <div className="vignette-photo" style={{ width: 84, height: 84, flex: "none" }}>
        <img src={p.url} alt={p.titre ?? ""} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }} className="pile">
        <div className="saisie" style={{ minHeight: 40 }}><input aria-label="Titre" placeholder="Titre (ex. : Fraisier)" value={titre} maxLength={80} onChange={(e) => setTitre(e.target.value)} style={{ padding: "8px 0" }} /></div>
        <div className="rangee" style={{ flexWrap: "nowrap", gap: 8 }}>
          <div className="saisie" style={{ minHeight: 40, flex: 1 }}><input aria-label="Prix indicatif" placeholder="Prix (ex. : dès 45 €)" value={prix} maxLength={40} onChange={(e) => setPrix(e.target.value)} style={{ padding: "8px 0" }} /></div>
          {modifie && (
            <button type="button" className="btn btn-secondaire btn-petit" disabled={enCours} onClick={() => demarrer(async () => setEtat(await majPhotoGalerie(p.id, titre, prix)))}>OK</button>
          )}
          <button type="button" className="btn btn-icone btn-fantome" aria-label="Retirer la photo" disabled={enCours}
            onClick={() => { if (window.confirm("Retirer cette photo de la galerie ?")) demarrer(async () => setEtat(await supprimerPhotoGalerie(p.id))); }}>
            <IcoCroix taille={18} />
          </button>
        </div>
        {etat?.erreur && <p className="erreur-champ">{etat.erreur}</p>}
      </div>
    </div>
  );
}

export function DatesBloquees({ dates }: { dates: { jour: string; motif: string | null }[] }) {
  const [etat, action] = useActionState(ajouterDateBloquee, null);
  const [enCours, demarrer] = useTransition();
  return (
    <>
      <form action={action}>
        <div className="grille-2" style={{ gap: 10 }}>
          <label className="champ"><span className="etiquette">Du</span><span className="saisie"><input type="date" name="du" required /></span></label>
          <label className="champ"><span className="etiquette">Au (facultatif)</span><span className="saisie"><input type="date" name="au" /></span></label>
        </div>
        <label className="champ"><span className="etiquette">Motif (privé)</span><span className="saisie"><input name="motif" maxLength={120} placeholder="Congés, salon…" /></span></label>
        <MessageEtat etat={etat} />
        <BoutonEnvoi className="btn btn-secondaire" enCours="Ajout…">Bloquer</BoutonEnvoi>
      </form>
      {dates.length > 0 && (
        <ul className="pile" style={{ padding: 0, margin: "16px 0 0", gap: 8 }}>
          {dates.map((d) => (
            <li key={d.jour} className="rangee espace-entre" style={{ listStyle: "none", borderBottom: "1px solid var(--bordure)", paddingBottom: 8 }}>
              <span><strong>{formaterDateCourte(d.jour)}</strong>{d.motif && <span className="doux petit"> · {d.motif}</span>}</span>
              <button type="button" className="btn btn-fantome btn-petit" disabled={enCours} onClick={() => demarrer(async () => { await supprimerDateBloquee(d.jour); })}>Débloquer</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
