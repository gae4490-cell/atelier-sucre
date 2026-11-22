# Livraison 1 — compte pâtissier → vitrine → demande depuis un autre appareil → notification

## Vérifié pendant le développement

| Contrôle | Résultat |
|---|---|
| `npm test` : 11 tests de logique métier (scénario Lina, champs obligatoires, date bloquée, délai minimum, date passée ou à plus d'un an, retrait/livraison, nombre de parts, téléphones FR/international, fuseau Europe/Paris au passage de minuit, liens publics, lien WhatsApp, formats d'image par les octets et limite de 5 Mo) | ✅ 11/11 |
| Migrations appliquées sur PostgreSQL 16 avec une simulation des schémas `auth` et `storage` de Supabase (`tests/sql/run.sh`) | ✅ |
| Isolation entre deux ateliers (`tests/sql/rls-test.sql`) : le pâtissier B ne voit ni la demande, ni la photo, ni la notification, ni l'historique d'e-mails, ni les dates bloquées, ni les réglages de A ; ne peut pas modifier sa demande, déposer un fichier dans son dossier ni rattacher un fichier de A à sa galerie ; un visiteur anonyme ne voit que les vitrines publiées et ne peut lire aucune demande ; un pâtissier ne peut pas modifier l'e-mail d'un client ; second atelier et lien déjà pris refusés ; limiteur de débit réservé au serveur | ✅ |
| Compilation TypeScript stricte de tout `src/` | ✅ avec des déclarations simplifiées de Next.js, React et Supabase (voir ci-dessous) |
| Rendu de la feuille de style dans Chrome (vitrine, formulaire étape 1, Mes demandes en mobile et sur ordinateur) | ✅ conforme aux maquettes après 3 retouches |

## Non vérifié ici — à faire de votre côté

L'environnement de développement n'avait pas d'accès réseau : `npm install` était impossible. Je n'ai donc **pas** pu lancer `next build`, ouvrir l'application, ni la connecter à un vrai projet Supabase ou Resend. La compilation TypeScript a été faite contre des définitions simplifiées des bibliothèques : `npm run typecheck` avec les vraies définitions peut encore signaler des écarts mineurs.

**Le navigateur intégré d'Instagram n'a pas été vérifié.** Le formulaire n'utilise que des éléments standard (champ date natif, envoi de fichier, `sessionStorage` facultatif, `fetch`) et réduit les photos dans le navigateur avant l'envoi. Le test reste à faire.

## Liste de contrôle « deux téléphones »

1. [ ] `npm install && npm run typecheck && npm run build` sans erreur
2. [ ] Téléphone A : inscription → e-mail de vérification reçu → lien ouvert → étape « Votre atelier »
3. [ ] Lien public choisi, photo ajoutée, vitrine publiée, lien copié
4. [ ] Téléphone B (si possible depuis la bio Instagram) : vitrine affichée, **Demander un devis**, date bloquée refusée, photo ajoutée, envoi
5. [ ] Message « Demande envoyée. Le pâtissier doit encore confirmer votre commande. » + e-mail récapitulatif reçu par le client
6. [ ] Téléphone A : e-mail « Nouvelle demande de devis » → **Voir la demande** → fiche avec photo
7. [ ] Espace ouvert sur ordinateur pendant l'envoi : alerte en direct sans recharger
8. [ ] **Répondre sur WhatsApp** ouvre la conversation avec le message prérempli
9. [ ] Second compte (`npm run seed`, `temoin@atelier-sucre.test`) : l'URL d'une fiche de l'atelier Démo affiche « Demande introuvable »
10. [ ] Appuyer deux fois sur **Envoyer ma demande** ou couper le réseau puis renvoyer : une seule demande créée

## Ce qui reste simulé ou à configurer

- E-mails : simulés tant que `EMAIL_PROVIDER=console` (ils apparaissent « Simulé » dans l'historique de la fiche). Envoi réel : clé Resend + domaine vérifié.
- Vérification d'e-mail en production : configurer le SMTP dans Supabase (limite du service intégré).
- Notifications sur l'écran verrouillé : non intégrées ; l'écran Notifications l'indique.
- Rappels à 24 h et la veille du retrait : préférences enregistrées, envois automatiques à venir.
- Devis, acomptes, solde, commandes, abonnements Stripe, limites des offres (30 demandes/mois en Essentiel) : livraisons suivantes. Les boutons concernés sont désactivés et signalés « bientôt ».

## Prochaine livraison proposée

Devis (brouillon, lien privé révocable et limité dans le temps, acceptation/refus) → acompte Stripe en mode test avec webhook signé et idempotent → confirmation et calendrier avec heures de retrait → offres et abonnement.
