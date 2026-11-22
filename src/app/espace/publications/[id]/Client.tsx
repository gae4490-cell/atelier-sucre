"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import {
  ajouterCreneau, ajouterPhotoPublication, changerStatutPublication, enregistrerPublication, publierPublication,
  supprimerCreneau, supprimerPhotoPublication, supprimerPublication, type EtatPub,
} from "../actions";
import { televerserPhotoPublication } from "@/lib/televersement";
import { CATEGORIES, type PublicationPublique } from "@/lib/publications";
import { centimesVersSaisie } from "@/lib/argent";
import { BoutonCopier, BoutonEnvoi, MessageEtat } from "@/components/ui";
import { IcoCheck, IcoCouronne, IcoCroix, IcoPlus } from "@/components/icones";

type Props = {
  pub: PublicationPublique;
  atelierId: string;
  estPro: boolean;
  lien: string;
  photos: { id: string; url: string }[];
  creneaux: { id: string; libelle: string; capacite: number | null; passe: boolean }[];
  restant: number | null;
  format: { nom: string; aide: string; bouton: string };
};

function PanneauPro({ id }: { id: string }) {
  return (
    <section className="carte" style={{ outline: "2px solid var(--prune)", background: "#fbeef1" }} aria-live="polite">
      <h2 className="rangee" style={{ fontSize: "1.3rem", gap: 8 }}><IcoCouronne /> Publiez votre vente flash avec Pro</h2>
      <p>Votre brouillon est enregistré et vous attendra. Avec l&apos;offre Pro, cette annonce pourra :</p>
      <ul className="pile" style={{ gap: 6, paddingLeft: 0, listStyle: "none" }}>
        <li className="rangee"><IcoCheck taille={18} /> recevoir les paiements en ligne de vos clients ;</li>
        <li className="rangee"><IcoCheck taille={18} /> suivre le stock en temps réel, sans survente ;</li>
        <li className="rangee"><IcoCheck taille={18} /> organiser les retraits par créneau, visibles au calendrier.</li>
      </ul>
      <Link href={`/espace/abonnement?offre=pro&retour=${encodeURIComponent(`/espace/publications/${id}?apres=pro`)}`} className="btn btn-primaire btn-large">
        Passer à Pro — 19 €/mois
      </Link>
    </section>
  );
}

export function EditeurPublication({ pub, atelierId, estPro, lien, photos, creneaux, restant, format }: Props) {
  const [etat, action] = useActionState(enregistrerPublication, null);
  const [etatCreneau, actionCreneau] = useActionState(ajouterCreneau, null);
  const [etatAction, setEtatAction] = useState<EtatPub>(null);
  const [enCours, demarrer] = useTransition();
  const fichier = useRef<HTMLInputElement>(null);
  const vf = pub.type === "vente_flash";
  const enLigne = pub.statut === "publiee";
  const besoinPro = vf && !estPro && !!(etat?.pro || etatAction?.pro);

  function ajouterPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const liste = Array.from(e.target.files ?? []).slice(0, 8);
    e.target.value = "";
    demarrer(async () => {
      for (const f of liste) {
        try {
          const { chemin, vignette } = await televerserPhotoPublication(f, atelierId);
          const r = await ajouterPhotoPublication(pub.id, chemin, vignette);
          if (r?.erreur) { setEtatAction(r); return; }
        } catch (err) {
          setEtatAction({ erreur: err instanceof Error ? err.message : "L'envoi a échoué." });
          return;
        }
      }
      setEtatAction({ succes: liste.length > 1 ? `${liste.length} photos ajoutées.` : "Photo ajoutée." });
    });
  }

  return (
    <div className="grille-fiche">
      <div className="pile">
        <div className="rangee espace-entre">
          <h1 className="titre-page" style={{ margin: 0 }}>{pub.titre || (vf ? "Nouvelle vente flash" : "Nouveau gâteau")}</h1>
          <span className={`badge ${enLigne ? "badge-vert" : pub.statut === "archivee" ? "badge-gris" : "badge-ambre"}`}>
            {enLigne ? "En ligne" : pub.statut === "archivee" ? "Archivée" : "Brouillon"}
          </span>
        </div>
        <p className="doux" style={{ margin: 0 }}>{format.nom} — {format.aide}</p>

        <section className="carte">
          <h2 style={{ fontSize: "1.2rem" }}>Photos</h2>
          <div className="vignettes-photo">
            {photos.map((p) => (
              <div key={p.id} className="vignette-photo">
                <img src={p.url} alt="" />
                <button type="button" className="retirer" aria-label="Retirer la photo" disabled={enCours}
                  onClick={() => demarrer(async () => setEtatAction(await supprimerPhotoPublication(p.id, pub.id)))}><IcoCroix taille={16} /></button>
              </div>
            ))}
            {photos.length < 8 && (
              <button type="button" className="ajout-photo" onClick={() => fichier.current?.click()} disabled={enCours}>
                {enCours ? <span className="spinner" style={{ borderTopColor: "var(--prune)" }} /> : <IcoPlus taille={28} />}
                {enCours ? "Envoi…" : "Ajouter des photos"}
              </button>
            )}
          </div>
          <input ref={fichier} type="file" accept="image/*" multiple hidden onChange={ajouterPhotos} />
          <MessageEtat etat={etatAction?.pro ? null : etatAction} />
        </section>

        <form action={action} className="carte">
          <input type="hidden" name="id" value={pub.id} />
          <input type="hidden" name="type" value={pub.type} />
          <label className="champ">
            <span className="etiquette">Titre <span className="requis">*</span></span>
            <span className="saisie"><input name="titre" maxLength={90} defaultValue={pub.titre} placeholder={vf ? "12 box de cupcakes" : "Layer cake fraise-pistache"} required /></span>
          </label>
          <label className="champ">
            <span className="etiquette">Description</span>
            <span className="saisie"><textarea name="description" maxLength={2000} defaultValue={pub.description ?? ""} placeholder="Parfums, taille, allergènes…" /></span>
          </label>
          <div className="grille-2" style={{ gap: 12 }}>
            <label className="champ">
              <span className="etiquette">Catégorie</span>
              <span className="saisie">
                <select name="categorie" defaultValue={pub.categorie ?? ""}>
                  <option value="">Choisir…</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </span>
            </label>
            <label className="champ">
              <span className="etiquette">{vf ? "Prix fixe par box *" : "Prix indicatif (facultatif)"}</span>
              <span className="saisie"><input name="prix" inputMode="decimal" defaultValue={centimesVersSaisie(pub.prix_cents)} placeholder={vf ? "18" : "à partir de 45"} /><span className="prefixe">€</span></span>
            </label>
            {vf && (
              <>
                <label className="champ">
                  <span className="etiquette">Quantité disponible *</span>
                  <span className="saisie"><input type="number" name="stock_total" min={1} max={1000} defaultValue={pub.stock_total ?? 12} required /></span>
                  {restant != null && <p className="aide">Restant : {restant}</p>}
                </label>
                <label className="champ">
                  <span className="etiquette">Maximum par client</span>
                  <span className="saisie"><input type="number" name="max_par_client" min={1} max={50} defaultValue={pub.max_par_client} /></span>
                </label>
              </>
            )}
          </div>
          <label className="champ">
            <span className="etiquette">Disponibilité</span>
            <span className="saisie"><input name="disponibilite" maxLength={160} defaultValue={pub.disponibilite ?? ""} placeholder={vf ? "Retrait samedi de 14 h à 17 h" : "Sur commande, 5 jours à l'avance"} /></span>
          </label>
          <MessageEtat etat={etat?.pro ? null : etat} />
          <div className="rangee">
            <BoutonEnvoi className="btn btn-secondaire" name="action" value="brouillon" enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
            {!enLigne && (
              <BoutonEnvoi className="btn btn-primaire" name="action" value="publier" enCours="Publication…">
                Publier{vf && !estPro ? " · Pro" : ""}
              </BoutonEnvoi>
            )}
          </div>
        </form>

        {vf && (
          <section className="carte">
            <h2 style={{ fontSize: "1.2rem" }}>Créneaux de retrait</h2>
            {creneaux.length === 0 && <p className="doux petit">Ajoutez au moins un créneau pour publier.</p>}
            <ul className="pile" style={{ padding: 0, margin: "0 0 12px", gap: 8 }}>
              {creneaux.map((c) => (
                <li key={c.id} className="rangee espace-entre" style={{ listStyle: "none", opacity: c.passe ? 0.5 : 1 }}>
                  <span>{c.libelle}{c.capacite ? ` · ${c.capacite} places` : ""}{c.passe ? " · passé" : ""}</span>
                  <button className="btn btn-fantome btn-petit" disabled={enCours} onClick={() => demarrer(async () => setEtatAction(await supprimerCreneau(c.id, pub.id)))}>Retirer</button>
                </li>
              ))}
            </ul>
            <form action={actionCreneau} className="grille-2" style={{ gap: 10, alignItems: "end" }}>
              <input type="hidden" name="publication_id" value={pub.id} />
              <label className="champ" style={{ margin: 0 }}><span className="etiquette">Date</span><span className="saisie"><input type="date" name="date" required /></span></label>
              <label className="champ" style={{ margin: 0 }}><span className="etiquette">Capacité (facultatif)</span><span className="saisie"><input type="number" name="capacite" min={1} placeholder="illimitée" /></span></label>
              <label className="champ" style={{ margin: 0 }}><span className="etiquette">De</span><span className="saisie"><input type="time" name="debut" defaultValue="14:00" required /></span></label>
              <label className="champ" style={{ margin: 0 }}><span className="etiquette">À</span><span className="saisie"><input type="time" name="fin" defaultValue="17:00" required /></span></label>
              <MessageEtat etat={etatCreneau} />
              <BoutonEnvoi className="btn btn-secondaire" enCours="Ajout…">Ajouter le créneau</BoutonEnvoi>
            </form>
          </section>
        )}
      </div>

      <aside className="pile">
        {besoinPro ? <PanneauPro id={pub.id} /> : vf && !estPro && pub.statut === "brouillon" ? <p className="alerte alerte-info" style={{ margin: 0 }}>Préparez et prévisualisez votre vente flash librement. Sa publication fait partie de l&apos;offre Pro.</p> : null}
        <section className="carte pile">
          <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Partager</h2>
          <p className="petit doux" style={{ margin: 0 }}>Chaque gâteau a son propre lien, à mettre en story ou en DM.</p>
          <p style={{ fontWeight: 600, overflowWrap: "anywhere", margin: 0 }}>{lien}</p>
          <div className="rangee">
            <BoutonCopier texte={`${lien}?src=instagram`} libelle="Copier le lien" className="btn btn-secondaire btn-petit" />
            <Link href={`/g/${pub.code}`} target="_blank" className="btn btn-fantome btn-petit">{enLigne ? "Ouvrir" : "Prévisualiser"}</Link>
          </div>
          {!enLigne && <p className="aide" style={{ margin: 0 }}>Le lien ne fonctionne pour le public qu&apos;une fois la publication en ligne.</p>}
        </section>
        <section className="carte pile">
          {enLigne && (
            <button className="btn btn-fantome" disabled={enCours} onClick={() => demarrer(async () => setEtatAction(await changerStatutPublication(pub.id, "archivee")))}>Archiver</button>
          )}
          {pub.statut === "archivee" && (
            <button className="btn btn-secondaire" disabled={enCours} onClick={() => demarrer(async () => setEtatAction(await publierPublication(pub.id)))}>Remettre en ligne</button>
          )}
          {pub.statut === "brouillon" && (
            <button className="btn btn-danger" disabled={enCours} onClick={() => { if (window.confirm("Supprimer ce brouillon ?")) demarrer(() => supprimerPublication(pub.id)); }}>Supprimer le brouillon</button>
          )}
        </section>
      </aside>
    </div>
  );
}
