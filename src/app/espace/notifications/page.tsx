import type { Metadata } from "next";
import Link from "next/link";
import { exigerAtelier } from "@/lib/atelier";
import type { Notification, Reglages } from "@/lib/types";
import { IcoCloche } from "@/components/icones";
import { BoutonToutLu, MarquerLu, PreferencesNotifications } from "./Client";

export const metadata: Metadata = { title: "Notifications" };

function quand(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso));
}

export default async function PageNotifications() {
  const { supabase, atelier } = await exigerAtelier();
  const [{ data: notifs }, { data: reglages }] = await Promise.all([
    supabase.from("notifications").select("*").eq("atelier_id", atelier.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("atelier_reglages").select("*").eq("atelier_id", atelier.id).single(),
  ]);
  const liste = (notifs ?? []) as Notification[];
  const nonLues = liste.filter((n) => !n.lue_le).length;

  return (
    <>
      <div className="rangee espace-entre" style={{ marginBottom: 16 }}>
        <h1 className="titre-page">Notifications</h1>
        {nonLues > 0 && <BoutonToutLu />}
      </div>
      <div className="grille-fiche">
        <section className="carte" style={{ padding: 0, overflow: "hidden" }}>
          {liste.length === 0 ? (
            <div className="etat-vide" style={{ border: 0 }}>
              <IcoCloche taille={36} />
              <p style={{ fontWeight: 600, margin: 0 }}>Aucune alerte pour le moment</p>
            </div>
          ) : (
            liste.map((n) => (
              <div key={n.id} className={`notif ${n.lue_le ? "" : "non-lue"}`}>
                {!n.lue_le && <span className="point-rose" style={{ marginTop: 8 }} aria-label="Non lue" />}
                <div className="contenu">
                  <strong>{n.lien ? <Link href={n.lien}>{n.titre}</Link> : n.titre}</strong>
                  {n.corps && <div className="petit">{n.corps}</div>}
                  <div className="doux petit">{quand(n.created_at)}</div>
                </div>
                {!n.lue_le && <MarquerLu id={n.id} />}
              </div>
            ))
          )}
        </section>

        <aside className="pile">
          <section className="carte">
            <h2 style={{ fontSize: "1.3rem" }}>Sur cet appareil</h2>
            <div className="alerte alerte-info" style={{ marginBottom: 12 }}>
              Notifications sur l&apos;écran verrouillé : <strong>non disponibles dans cette version pilote</strong>.
            </div>
            <button className="btn btn-fantome" disabled style={{ width: "100%" }}>Activer les notifications sur cet appareil</button>
            <p className="aide">
              Canaux disponibles : <strong>e-mail</strong> et <strong>alerte dans l&apos;application</strong> (mise à jour en direct quand l&apos;espace est ouvert).
            </p>
          </section>
          {reglages && (
            <section className="carte">
              <h2 style={{ fontSize: "1.3rem" }}>Rappels et e-mails</h2>
              <PreferencesNotifications reglages={reglages as Reglages} />
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
