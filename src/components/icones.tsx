// Icônes au trait (style des maquettes), sans dépendance.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { taille?: number };

function Svg({ taille = 20, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Logo : gâteau à étages surmonté d'un cœur */
export const IcoGateau = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.2c-.6-.9-2-.6-2 .5 0 .9 2 2.1 2 2.1s2-1.2 2-2.1c0-1.1-1.4-1.4-2-.5Z" />
    <path d="M12 6v2" />
    <rect x="6.5" y="8" width="11" height="4.5" rx="1.2" />
    <path d="M6.5 10.3c1 .8 1.9.8 2.8 0 .9.8 1.8.8 2.7 0 .9.8 1.8.8 2.7 0 .9.8 1.9.8 2.8 0" />
    <rect x="3.5" y="12.5" width="17" height="6" rx="1.4" />
    <path d="M3.5 15.3c1.4 1 2.8 1 4.2 0 1.4 1 2.8 1 4.3 0 1.4 1 2.8 1 4.2 0 1.4 1 2.8 1 4.3 0" />
    <path d="M2.5 20.5h19" />
  </Svg>
);
export const IcoMail = (p: P) => (<Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></Svg>);
export const IcoCadenas = (p: P) => (<Svg {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></Svg>);
export const IcoOeil = (p: P) => (<Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></Svg>);
export const IcoOeilBarre = (p: P) => (<Svg {...p}><path d="M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16.4 16.4 0 0 1-2.6 3.4M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.4-.6 4.7-1.4" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="m3 3 18 18" /></Svg>);
export const IcoCalendrier = (p: P) => (<Svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>);
export const IcoPersonnes = (p: P) => (<Svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5" /><path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.5 14.8c1.8.6 3.1 2.2 3.5 4.7" /></Svg>);
export const IcoPart = (p: P) => (<Svg {...p}><path d="M3.5 18.5V12l15-6.5v13Z" /><path d="M3.5 14.5l15-5" /><path d="M3.5 18.5h17" /></Svg>);
export const IcoPhoto = (p: P) => (<Svg {...p}><rect x="3" y="4.5" width="18" height="15" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m3.5 17.5 5-4.5 4 3.5 3-2.5 5 4" /></Svg>);
export const IcoPlus = (p: P) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>);
export const IcoCroix = (p: P) => (<Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>);
export const IcoFlecheDroite = (p: P) => (<Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>);
export const IcoChevronDroit = (p: P) => (<Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>);
export const IcoChevronBas = (p: P) => (<Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>);
export const IcoFlecheGauche = (p: P) => (<Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>);
export const IcoEnvoi = (p: P) => (<Svg {...p}><path d="M21 3 10.5 13.5" /><path d="M21 3 14.5 21l-4-7.5L3 9.5Z" /></Svg>);
export const IcoBulle = (p: P) => (<Svg {...p}><path d="M20.5 11.5a8.5 8 0 0 1-12.2 7.2L3.5 20l1.4-4.2a7.6 7.6 0 0 1-1.4-4.3 8.5 8 0 0 1 17 0Z" /></Svg>);
export const IcoInstagram = (p: P) => (<Svg {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".6" fill="currentColor" /></Svg>);
export const IcoMaison = (p: P) => (<Svg {...p}><path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5v10h13v-10" /><path d="M10 19.5v-5h4v5" /></Svg>);
export const IcoReglages = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Svg>);
export const IcoCloche = (p: P) => (<Svg {...p}><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></Svg>);
export const IcoDocument = (p: P) => (<Svg {...p}><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5Z" /><path d="M14 3.5v5h5M9 13h6M9 16.5h6" /></Svg>);
export const IcoSac = (p: P) => (<Svg {...p}><path d="M5 8h14l-1 12.5H6Z" /><path d="M9 10V6.5a3 3 0 0 1 6 0V10" /></Svg>);
export const IcoCarte = (p: P) => (<Svg {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 10h19M6 15h4" /></Svg>);
export const IcoHorloge = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>);
export const IcoCheck = (p: P) => (<Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>);
export const IcoLien = (p: P) => (<Svg {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>);
export const IcoCopier = (p: P) => (<Svg {...p}><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" /></Svg>);
export const IcoRecherche = (p: P) => (<Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg>);
export const IcoSortie = (p: P) => (<Svg {...p}><path d="M14 4.5h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-4" /><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15" /></Svg>);
export const IcoToque = (p: P) => (<Svg {...p}><path d="M7 14.5a4 4 0 0 1-1-7.8 5 5 0 0 1 9.5-1.5A4 4 0 1 1 17 14.5" /><path d="M7 14.5v4.5h10v-4.5" /><path d="M7 16.5h10" /></Svg>);
export const IcoCouronne = (p: P) => (<Svg {...p}><path d="m3.5 8 4.2 3.5L12 5.5l4.3 6 4.2-3.5-1.8 10H5.3Z" /></Svg>);
export const IcoBoutique = (p: P) => (<Svg {...p}><path d="M4 9.5 5.5 4.5h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 11.5v8h13v-8" /><path d="M10 19.5v-4h4v4" /></Svg>);
export const IcoMenu = (p: P) => (<Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>);
export const IcoEquipe = IcoPersonnes;
export const IcoUtilisateur = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.5 18.3c1.2-2 3.1-3 5.5-3s4.3 1 5.5 3" /></Svg>);
export const IcoTelephone = (p: P) => (<Svg {...p}><path d="M5 3.5h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.8 6.8l1.4-2.2 4.3 1.7V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2Z" /></Svg>);
export const IcoEpingle = (p: P) => (<Svg {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></Svg>);
export const IcoEtincelle = (p: P) => (<Svg {...p}><path d="M12 3.5 13.8 10 20.5 12l-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2Z" /></Svg>);
export const IcoWhatsApp = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4Z" />
    <path d="M9 8.5c0 3.3 3.2 6.5 6.5 6.5l1-1.6-2-1-1 1c-1.2-.4-2.4-1.6-2.8-2.8l1-1-1-2Z" />
  </Svg>
);
