# Atelier Sucré — version pilote

Application web en français pour les pâtissiers qui vendent leurs gâteaux depuis Instagram : vitrine publique, demandes de devis, devis avec acompte, commandes et calendrier, publications partageables, fil « Découvrir », offres Essentiel / Pro et ventes flash avec stock et créneaux.

Stack : Next.js 15 (App Router, TypeScript), Supabase (comptes, PostgreSQL avec RLS, stockage, temps réel), Stripe **en mode test** (appels HTTP directs, sans SDK), e-mails via Resend ou simulés.

## État des fonctions

| Étape du cahier des charges | État |
|---|---|
| 1. Compte, inscription autonome en 4 étapes, vitrine, lien Instagram, demande depuis un autre appareil | ✅ |
| 2. Notifications, devis, acompte test, solde, calendrier | ✅ |
| 3. Publications (3 formats), fiches `/g/{code}` partageables, fil « Découvrir », demande rattachée au gâteau, provenance | ✅ |
| 4. Offres, quota Essentiel, passage à Pro (brouillon conservé), ventes flash, stock, retraits | ✅ |
| 5. Comptes d'équipe et export CSV (offre Atelier) | ⏳ affichée « À venir », achat désactivé |
| Notifications sur l'écran verrouillé | ❌ non intégrées ; l'écran Notifications indique les canaux réels (e-mail + alerte dans l'application) |

## Démarrage

Prérequis : Node.js 20.9+, un projet Supabase (gratuit). Stripe et Resend sont facultatifs pour un premier essai.

```bash
npm install
cp .env.example .env.local        # renseigner au minimum les 3 valeurs Supabase
npx supabase link --project-ref VOTRE_REF
npx supabase db push              # applique les 3 migrations (les données existantes sont conservées)
npm run seed                      # données fictives : Sarah (Pro simulé), Lina, vente flash, atelier témoin
npm run dev                       # http://localhost:3000
```

Sans clé Stripe, les paiements passent par une page **« Paiement simulé »** clairement signalée, qui appelle exactement la même confirmation serveur que le webhook Stripe. Sans clé Resend, les e-mails sont écrits dans les logs et marqués « Simulé » dans l'historique.

Configuration détaillée de Supabase, Stripe (mode test), Resend et Vercel : `docs/DEPLOIEMENT.md`.

## Tests

| Commande | Contenu |
|---|---|
| `npm test` | 19 tests de logique : validation des demandes, dates et fuseau, montants en centimes, signature des webhooks Stripe, encodage Stripe, jetons des liens privés, conversion des créneaux |
| `bash tests/sql/run.sh` | Migrations sur un PostgreSQL jetable (binaires PostgreSQL requis, `PGBIN=...`), puis : isolation entre ateliers, scénarios Lina et Sarah, cas limites de paiement, achat simultané de la dernière box, mise à jour d'une base existante |
| `npm run typecheck` | Vérification TypeScript |

## Reproduire le scénario Lina (devis 80 €, acompte 25 €)

Prérequis : `npm run seed`, puis l'application lancée.

1. Connectez-vous avec `demo@atelier-sucre.test` / `AtelierDemo2026!` (atelier « Les gâteaux de Sarah », offre Pro simulée).
2. **Demandes** › fiche de **Lina** (thème espace, chocolat, 15 parts, provenance « Lien Instagram marqué ») › **Créer un devis**.
   *(Pour partir de zéro : ouvrez `/p/les-gateaux-de-sarah?src=instagram` sur un autre téléphone et envoyez la demande vous-même.)*
3. Prix total `80`, acompte `25`, date de validité, date et heure de retrait › **Envoyer le devis**. Copiez le lien privé affiché (ou ouvrez l'e-mail reçu par le client).
4. Ouvrez le lien (navigation privée ou autre téléphone) › **Accepter le devis** › **Payer 25 € d'acompte** › payez (carte de test Stripe `4242 4242 4242 4242`, ou bouton « Payer (simulation) »).
5. Le client voit « Acompte reçu — 25 € payés — Reste à payer 55 € — Commande confirmée ».
6. Côté Sarah : alerte « Acompte reçu », **Commandes** › 25 € reçus, 55 € restants ; **Calendrier** : la commande au jour du retrait. Depuis la commande : **Envoyer un lien pour le solde** ou **Enregistrer le règlement** reçu au retrait.

## Reproduire le scénario Sarah (vente flash de 12 box à 18 €)

1. Connecté en Sarah : **Publications** › « 12 box de cupcakes » (en ligne, créneau samedi 14 h – 17 h, stock 12) › **Copier le lien**.
   *(Pour la créer vous-même : **Créer une vente flash** › titre, photo, prix 18, quantité 12, créneau samedi 14:00–17:00 › **Publier**.)*
2. Sur un autre téléphone, ouvrez le lien copié (`/g/{code}?src=instagram`, comme depuis une story) › choisissez le créneau, 1 box, vos coordonnées › **Réserver et payer 18 €** › payez.
3. La cliente voit « Réservation confirmée », 18 €, l'heure et le lieu de retrait (et reçoit l'e-mail).
4. Sarah reçoit l'alerte « Nouvelle réservation » ; la publication affiche **11/12** ; la commande apparaît au **Calendrier** le samedi.

**Passage d'Essentiel à Pro sans perdre le brouillon** : connectez-vous avec `temoin@atelier-sucre.test` (Essentiel) › **Créer une vente flash · Pro** › préparez l'annonce et ajoutez un créneau › **Publier · Pro** : le panneau explique ce que Pro débloque › **Passer à Pro** › après confirmation, retour automatique sur le brouillon, intact, à publier.

## Organisation du code

```
src/app/                 pages : vitrine /p, fiche /g, /decouvrir, /devis/{lien}, /paiement/{lien},
                         /reservation/{id}, espace /espace/*, API /api/demandes, /api/stripe/webhook, /api/cron/rappels
src/lib/                 validation, montants, Stripe, paiements, abonnements, e-mails, accès
supabase/migrations/     schéma, RLS, stockage, fonctions atomiques (réservations, paiements, devis)
tests/                   tests unitaires et SQL
docs/                    déploiement, rapport de vérification
```

Les tarifs se modifient dans `src/lib/offres.ts`.
