import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerAtelier } from "@/lib/atelier";
import { UUID_RE } from "@/lib/navigation";
import { ETAPES, DEVIS, SOURCES, type StatutDevis } from "@/lib/statuts";
import { formaterEuros } from "@/lib/argent";
import { abonnementCourant } from "@/lib/acces";
import { creerBrouillonDevis } from "../../devis/actions";
import { BoutonEnvoi } from "@/components/ui";
import { formaterDateCourte, formaterTelephone } from "@/lib/validation";
import { messageParDefaut } from "@/lib/whatsapp";
import type { Demande, LigneEmail } from "@/lib/types";
import { IcoCalendrier, IcoEpingle, IcoFlecheGauche, IcoMail, IcoPersonnes, IcoPhoto, IcoTelephone, IcoDocument } from "@/components/icones";
import { BadgeStatut } from "../composants";
import { ActionStatut, NotePrivee, RepondreWhatsApp } from "./Interactions";

export const metadata: Metadata = { title: "Demande" };

const LIB_EMAIL: Record<string, string> = {
  confirmation_client: "Confirmation au client",
  alerte_patissier: "Alerte pâtissier",
  devis_envoye: "Devis envoyé au client",
  devis_accepte: "Devis accepté (alerte)",
  devis_refuse: "Devis refusé (alerte)",
  paiement_acompte_client: "Confirmation d'acompte au client",
  paiement_acompte_patissier: "Acompte reçu (alerte)",
  rappel_24h: "Rappel : demande sans réponse",
};
const STATUT_EMAIL: Record<LigneEmail["statut"], { l: string; c: string }> = {
  envoye: { l: "Envoyé", c: "badge-vert" },
  simule: { l: "Simulé (mode test)", c: "badge-gris" },
  en_attente: { l: "En attente", c: "badge-ambre" },
  echec: { l: "Échec", c: "badge-rose" },
};

function heure(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso));
}

export default async function FicheDemande({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, atelier } = await exigerAtelier();

  // RLS : une demande d'un autre atelier renvoie « introuvable », même avec l'URL exacte.
  const { data } = await supabase.from("demandes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const d = data as Demande;

  const [{ data: listeDevis }, { data: publication }, { data: commande }, ab] = await Promise.all([
    supabase.from("devis").select("id, statut, total_cents, acompte_cents, created_at").eq("demande_id", id).order("created_at", { ascending: false }),
    d.publication_id ? supabase.from("publications").select("id, code, titre, type, prix_cents").eq("id", d.publication_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("commandes_suivi").select("id, paye_cents, reste_cents, statut").eq("demande_id", id).maybeSingle(),
    abonnementCourant(),
  ]);
  const devisActif = (listeDevis ?? []).find((x) => ["envoye", "accepte"].includes(x.statut));
  const brouillon = (listeDevis ?? []).find((x) => x.statut === "brouillon");
  const creerDevis = creerBrouillonDevis.bind(null, id);
  const [{ data: emails }, photo] = await Promise.all([
    supabase.from("emails").select("id, type, destinataire, sujet, statut, erreur, tentatives, created_at, updated_at").eq("demande_id", id).order("created_at"),
    d.photo_path ? supabase.storage.from("inspirations").createSignedUrl(d.photo_path, 3600) : Promise.resolve(null),
  ]);
  const urlPhoto = photo && "data" in photo ? photo.data?.signedUrl : undefined;

  if (!d.lue_le) {
    await Promise.all([
      supabase.from("demandes").update({ lue_le: new Date().toISOString() }).eq("id", id),
      supabase.from("notifications").update({ lue_le: new Date().toISOString() }).eq("demande_id", id).is("lue_le", null),
    ]);
  }

  const dateLisible = formaterDateCourte(d.date_souhaitee);
  const indexEtape = ETAPES.findIndex((e) => e.statut === d.statut);
  const message = messageParDefaut({ prenom: d.prenom, nomAtelier: atelier.nom, dateLisible, nbParts: d.nb_parts, theme: d.theme });
  const listeEmails = (emails ?? []) as LigneEmail[];

  return (
    <>
      <Link href="/espace/demandes" className="rangee petit" style={{ gap: 6, textDecoration: "none", marginBottom: 8 }}>
        <IcoFlecheGauche taille={16} /> Mes demandes
      </Link>
      <div className="rangee espace-entre" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="titre-page" style={{ marginBottom: 4 }}>{d.prenom}</h1>
          <span className="doux petit">Demande n° {d.numero} · reçue le {heure(d.created_at)}</span>
        </div>
        <BadgeStatut statut={d.statut} />
      </div>

      <div className="grille-fiche">
        <div className="pile">
          <section className="carte">
            <div className="statuts-separes" style={{ marginBottom: 16 }}>
              <div><div className="t">Devis</div><strong>{listeDevis?.[0] ? DEVIS[listeDevis[0].statut as StatutDevis].l : "Pas encore créé"}</strong></div>
              <div><div className="t">Commande</div><strong>{commande ? <Link href={`/espace/commandes/${commande.id}`}>{indexEtape >= 4 ? ETAPES[indexEtape].libelle : "Confirmée"}</Link> : "Pas encore"}</strong></div>
              <div><div className="t">Paiement</div><strong>{commande ? `${formaterEuros(commande.paye_cents)} reçus · ${formaterEuros(commande.reste_cents)} restants` : devisActif?.acompte_cents ? "Acompte attendu" : "Aucun"}</strong></div>
            </div>
            <ol className="pile" style={{ gap: 6, padding: 0, margin: 0 }} aria-label="Étapes de la commande">
              {ETAPES.map((e, i) => (
                <li key={e.statut} style={{ listStyle: "none", display: "flex", gap: 10, alignItems: "center", opacity: i <= indexEtape ? 1 : 0.5 }}>
                  <span className="pastille" style={{ width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: i <= indexEtape ? "var(--prune)" : "var(--creme-3)", color: i <= indexEtape ? "#fff" : "var(--texte-doux)" }}>{i + 1}</span>
                  <span style={{ fontWeight: i === indexEtape ? 700 : 500 }}>{e.libelle}</span>
                  {i === indexEtape && <span className="doux petit">— {e.aide}</span>}
                </li>
              ))}
            </ol>
          </section>

          {publication && (
            <section className="carte-rose rangee espace-entre">
              <span>Gâteau demandé : <strong>{publication.titre}</strong>{publication.prix_cents ? ` · ${formaterEuros(publication.prix_cents)}` : ""}</span>
              <Link href={`/espace/publications/${publication.id}`} className="btn btn-fantome btn-petit">Voir la publication</Link>
            </section>
          )}
          <section className="carte">
            <h2 style={{ fontSize: "1.3rem" }}>Le projet</h2>
            <p className="doux petit" style={{ marginTop: -6 }}>Provenance : {SOURCES[d.source] ?? SOURCES.inconnue}</p>
            {urlPhoto ? (
              <a href={urlPhoto} target="_blank" rel="noopener noreferrer" className="photo photo-large" style={{ marginBottom: 16 }} aria-label="Ouvrir la photo en grand">
                <img src={urlPhoto} alt={`Photo d'inspiration envoyée par ${d.prenom}`} />
              </a>
            ) : (
              <div className="photo" style={{ height: 90, marginBottom: 16 }}><IcoPhoto /> <span className="petit" style={{ marginLeft: 8 }}>Pas de photo d&apos;inspiration</span></div>
            )}
            <dl className="liste-def">
              <dt>Date souhaitée</dt><dd className="rangee" style={{ gap: 6 }}><IcoCalendrier taille={18} /> {dateLisible}</dd>
              <dt>Nombre de parts</dt><dd className="rangee" style={{ gap: 6 }}><IcoPersonnes taille={18} /> {d.nb_parts} parts</dd>
              {d.type_evenement && (<><dt>Événement</dt><dd>{d.type_evenement}</dd></>)}
              {d.theme && (<><dt>Thème</dt><dd>{d.theme}</dd></>)}
              {d.parfum && (<><dt>Saveur</dt><dd>{d.parfum}</dd></>)}
              {d.budget_indicatif && (<><dt>Budget indicatif</dt><dd>{d.budget_indicatif}</dd></>)}
              <dt>Mode</dt>
              <dd className="rangee" style={{ gap: 6 }}><IcoEpingle taille={18} /> {d.mode === "retrait" ? "Retrait" : `Livraison — ${d.adresse_livraison ?? ""}`}</dd>
            </dl>
            {d.message && (
              <blockquote style={{ margin: "16px 0 0", padding: "12px 16px", background: "var(--creme-2)", borderRadius: 12, whiteSpace: "pre-line" }}>
                {d.message}
              </blockquote>
            )}
          </section>

          <section className="carte">
            <h2 style={{ fontSize: "1.3rem" }}>Historique des e-mails</h2>
            {listeEmails.length === 0 ? (
              <p className="doux petit" style={{ margin: 0 }}>Envoi en cours… actualisez dans quelques secondes.</p>
            ) : (
              <ul className="pile" style={{ padding: 0, margin: 0, gap: 10 }}>
                {listeEmails.map((e) => (
                  <li key={e.id} style={{ listStyle: "none" }} className="rangee espace-entre">
                    <span>
                      <strong>{LIB_EMAIL[e.type] ?? e.type}</strong>
                      <span className="doux petit"> · {e.destinataire} · {heure(e.updated_at)}</span>
                      {e.statut === "echec" && e.erreur && <span className="erreur-champ" style={{ display: "block", margin: 0 }}>{e.erreur}</span>}
                    </span>
                    <span className={`badge ${STATUT_EMAIL[e.statut].c}`}>{STATUT_EMAIL[e.statut].l}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="pile">
          <section className="carte pile">
            <h2 style={{ fontSize: "1.3rem", margin: 0 }}>Répondre</h2>
            <RepondreWhatsApp telephone={d.telephone} messageInitial={message} />
            <div className="pile" style={{ gap: 8 }}>
              <a href={`tel:+${d.telephone}`} className="ligne-icone"><IcoTelephone taille={18} /> {formaterTelephone(d.telephone)}</a>
              <a href={`mailto:${d.email}?subject=${encodeURIComponent(`Votre demande de gâteau — ${atelier.nom}`)}`} className="ligne-icone" style={{ overflowWrap: "anywhere" }}>
                <IcoMail taille={18} /> {d.email}
              </a>
            </div>
            {brouillon ? (
              <Link href={`/espace/devis/${brouillon.id}`} className="btn btn-primaire"><IcoDocument /> Reprendre le brouillon de devis</Link>
            ) : !commande && (
              <form action={creerDevis}>
                <BoutonEnvoi className="btn btn-primaire" enCours="Création…"><IcoDocument /> {devisActif ? "Nouveau devis (remplace l'actuel)" : "Créer un devis"}</BoutonEnvoi>
              </form>
            )}
            {!ab.estPro && <p className="aide" style={{ marginTop: -8 }}>Brouillon possible ; l&apos;envoi avec acompte fait partie de l&apos;offre <Link href="/espace/abonnement?offre=pro">Pro</Link>.</p>}
            {(listeDevis ?? []).filter((x) => x.statut !== "brouillon").map((x) => (
              <Link key={x.id} href={`/espace/devis/${x.id}`} className="rangee espace-entre petit" style={{ textDecoration: "none" }}>
                <span>Devis {formaterEuros(x.total_cents)}</span>
                <span className={`badge badge-${DEVIS[x.statut as StatutDevis].ton}`}>{DEVIS[x.statut as StatutDevis].l}</span>
              </Link>
            ))}
          </section>

          <section className="carte">
            <NotePrivee id={d.id} note={d.note_privee} />
          </section>

          <ActionStatut id={d.id} statut={d.statut} />
        </aside>
      </div>
    </>
  );
}
