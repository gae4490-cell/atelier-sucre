# Rapport de vérification — livraisons 1 à 4

Environnement de développement **sans accès réseau** : `npm install` impossible. Les vérifications ont porté sur la base de données (PostgreSQL 16 réel), la logique TypeScript pure (Node 22), la compilation TypeScript (avec des définitions simplifiées de Next.js, React et Supabase) et le rendu CSS (Chrome). **L'application n'a pas été lancée** (`next build` / `next dev` non exécutés), ni connectée à Supabase, Stripe ou Resend.

## Tests réellement exécutés

### Base de données (`bash tests/sql/run.sh`)
Migrations appliquées sur PostgreSQL 16 avec une simulation minimale des schémas `auth` et `storage` de Supabase.

| Exigence | Résultat |
|---|---|
| Isolation : demandes, photos privées, notifications, e-mails, dates bloquées, réglages, galerie | ✅ |
| Isolation : devis, commandes, paiements, réservations, abonnements, actions (envoi de devis, règlement, lien de solde, créneaux) | ✅ |
| Devis à 80 €, acompte 25 € : commande confirmée après paiement, 25 € reçus, **55 € restants**, commande au bon jour | ✅ |
| Devis en Essentiel : brouillon possible, envoi refusé par la base | ✅ |
| Devis envoyé figé ; acompte > total refusé | ✅ |
| Devis **remplacé** : non acceptable, non payable | ✅ |
| Devis **expiré** : marqué expiré, non payable | ✅ |
| **Paiement abandonné** : aucune commande | ✅ |
| Montant falsifié (≠ montant enregistré) refusé | ✅ |
| **Webhook reçu deux fois** : une commande, une alerte, une confirmation | ✅ |
| Session de paiement réutilisée en cas de double clic | ✅ |
| Solde : lien de 55 €, règlement au retrait, montant > reste refusé | ✅ |
| Vente flash en Essentiel : brouillon possible, **publication refusée** par la base | ✅ |
| **Passage à Pro : brouillon conservé** puis publié | ✅ |
| 12 box à 18 € : prix calculé par le serveur, achat d'une box, **stock 11**, commande au **samedi 14 h 00 – 17 h 00** | ✅ |
| **Deux achats simultanés de la dernière box** (deux connexions parallèles) : une seule réservation, l'autre « stock insuffisant » | ✅ |
| **Réservation expirée libérée** et remise en vente | ✅ |
| Confirmation tardive sur stock épuisé : **pas de survente**, paiement marqué « à rembourser » | ✅ |
| Fin de l'accès Pro : nouvelles réservations bloquées, **paiement déjà engagé honoré**, commandes payées toujours visibles | ✅ |
| Publications : brouillons invisibles du public et de leur lien direct | ✅ |
| Lien d'atelier modifié après publication : ancien lien conservé, réservé, et suggestion de variante | ✅ |
| Migration 3 sur une base existante : données conservées, abonnement Essentiel créé | ✅ |

### Logique applicative (`npm test`, 19 tests)
Validation des demandes, dates bloquées et délai, fuseau Europe/Paris, téléphones, liens, WhatsApp, images ; montants en centimes ; **signature des webhooks Stripe** (corps modifié, mauvais secret, rejeu tardif) ; encodage des paramètres Stripe ; jetons des liens privés ; conversion des créneaux (hiver, été, changement d'heure).

### Compilation et rendu
- TypeScript strict sur tout `src/` : ✅ (définitions simplifiées des bibliothèques).
- Rendu Chrome : vitrine, formulaire, Mes demandes, devis client, « Acompte reçu », fiche de vente flash, fil Découvrir : conformes aux maquettes.

## Non vérifié — et comment le vérifier

| Point | Raison | Comment vérifier |
|---|---|---|
| Build et exécution Next.js | pas de `npm install` | `npm install && npm run typecheck && npm run build` |
| Parcours sur deux téléphones | application non lancée | README, scénarios Lina et Sarah |
| E-mails réels, une seule alerte par envoi | pas de Resend | `EMAIL_PROVIDER=resend` ; historique de la fiche demande |
| Stripe réel (Checkout, webhook, portail) | pas de clés | `stripe listen` + carte 4242 ; renvoyer un événement depuis le tableau Stripe pour tester le doublon |
| Retour de paiement fermé | idem | payer puis fermer l'onglet avant le retour : le webhook confirme (tableau de bord à jour) |
| Temps réel (alerte sans recharger) | pas de Supabase | espace ouvert sur ordinateur, demande envoyée depuis un téléphone |
| **Navigateur intégré d'Instagram** | **non testé** | mettre le lien en bio ou en story, l'ouvrir depuis l'app Instagram (iOS et Android), envoyer une demande avec photo et payer |
| WhatsApp sur mobile | non testé sur appareil | bouton « Répondre sur WhatsApp » depuis un téléphone |

## Fonctions simulées ou limitées
- Paiements **simulés** tant que `STRIPE_SECRET_KEY` est absent (bandeau visible sur chaque écran de paiement).
- Paiements des clients encaissés sur le **compte de démonstration** (Stripe Connect par atelier non développé ; voir `docs/DEPLOIEMENT.md`).
- Offre Pro de l'atelier de démo **simulée** par le jeu de données.
- Notifications sur l'écran verrouillé : non intégrées.
- Offre Atelier (équipes, rôles, export CSV) : « À venir ».
- Quota Essentiel : contrôle serveur non verrouillé : deux demandes envoyées à la même seconde peuvent dépasser la limite d'une unité.
- Calendrier et dates bloquées restent accessibles en Essentiel (seuls devis, ventes flash, rappels et quota sont restreints côté serveur).
