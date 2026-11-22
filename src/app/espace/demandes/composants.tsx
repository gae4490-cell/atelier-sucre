import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Demande } from "@/lib/types";
import { LIBELLES, TON } from "@/lib/statuts";
import { formaterDateCourte } from "@/lib/validation";
import { IcoCalendrier, IcoChevronDroit, IcoGateau, IcoPersonnes, IcoPhoto } from "@/components/icones";

export type DemandeListe = Pick<
  Demande,
  "id" | "numero" | "prenom" | "date_souhaitee" | "nb_parts" | "theme" | "type_evenement" | "parfum" | "statut" | "photo_path" | "lue_le" | "created_at"
>;

export const COLONNES_LISTE = "id, numero, prenom, date_souhaitee, nb_parts, theme, type_evenement, parfum, statut, photo_path, lue_le, created_at";

/** URLs signées (1 h) des photos privées — la base refuse celles d'un autre atelier. */
export async function urlsPhotos(supabase: SupabaseClient, chemins: (string | null)[]): Promise<Record<string, string>> {
  const liste = chemins.filter((c): c is string => !!c);
  if (liste.length === 0) return {};
  const { data } = await supabase.storage.from("inspirations").createSignedUrls(liste, 3600);
  const out: Record<string, string> = {};
  for (const s of data ?? []) if (s.path && s.signedUrl) out[s.path] = s.signedUrl;
  return out;
}

export function BadgeStatut({ statut }: { statut: Demande["statut"] }) {
  return <span className={`badge badge-${TON[statut]}`}>{LIBELLES[statut]}</span>;
}

export function CarteDemande({ d, photo }: { d: DemandeListe; photo?: string }) {
  const titre = d.theme ? `Gâteau thème ${d.theme.toLowerCase()}` : d.type_evenement ?? "Gâteau sur mesure";
  return (
    <article className={`carte-demande ${!d.lue_le && d.statut === "nouvelle" ? "non-lue" : ""}`}>
      <div className="photo">{photo ? <img src={photo} alt={`Inspiration de ${d.prenom}`} loading="lazy" /> : <IcoPhoto taille={30} />}</div>
      <div className="infos">
        <div className="rangee espace-entre" style={{ flexWrap: "nowrap" }}>
          <span className="nom" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{d.prenom}</span>
          <BadgeStatut statut={d.statut} />
        </div>
        <span className="ligne-icone"><IcoGateau taille={18} /> {titre}</span>
        <span className="ligne-icone"><IcoPersonnes taille={18} /> {d.nb_parts} parts</span>
        <span className="ligne-icone"><IcoCalendrier taille={18} /> {formaterDateCourte(d.date_souhaitee)}</span>
      </div>
      <Link href={`/espace/demandes/${d.id}`} className="btn btn-primaire">
        Voir la demande <IcoChevronDroit />
      </Link>
    </article>
  );
}
