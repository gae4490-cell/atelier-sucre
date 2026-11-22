# Déploiement et configuration des services

## 1. Supabase

1. Créer un projet sur https://supabase.com (région UE, ex. Paris `eu-west-3`).
2. **Project Settings > API** : copier `Project URL`, la clé `anon` et la clé `service_role` dans `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
   La clé `service_role` ne doit jamais être exposée au navigateur (pas de préfixe `NEXT_PUBLIC_`).
3. Appliquer les migrations (`npx supabase db push`, ou SQL Editor dans l'ordre des fichiers).
   Elles créent les tables, les règles RLS, les buckets `vitrines` (public) et `inspirations` (privé)
   et ajoutent la table `notifications` à la publication temps réel.
4. **Authentication > URL Configuration**
   - Site URL : l'URL de production, ex. `https://atelier-sucre.vercel.app`
   - Redirect URLs : `https://atelier-sucre.vercel.app/**` (+ `http://localhost:3000/**`, + l'URL réseau local si besoin)
5. **Authentication > Providers > Email** : laisser *Confirm email* activé. Mot de passe minimum : 8.
6. **Authentication > Email Templates** (recommandé pour pouvoir ouvrir le lien sur un autre appareil que celui de l'inscription) :
   - *Confirm signup* : coller `supabase/templates/confirmation.html`, sujet « Activez votre compte Atelier Sucré »
   - *Reset password* : coller `supabase/templates/recovery.html`, sujet « Réinitialisez votre mot de passe Atelier Sucré »
   Sans ce changement, les liens par défaut fonctionnent aussi, mais seulement dans le navigateur où l'inscription a été faite.
7. **E-mails d'authentification en production** : le service d'envoi intégré de Supabase est limité (quelques e-mails par heure).
   Pour le pilote, configurer *Authentication > SMTP Settings* avec Resend :
   hôte `smtp.resend.com`, port `465`, utilisateur `resend`, mot de passe = clé API Resend, expéditeur = adresse du domaine vérifié.

## 2. E-mails transactionnels (demandes)

- `EMAIL_PROVIDER=console` : aucun envoi réel. Les e-mails sont écrits dans les logs et apparaissent « Simulé (mode test) » dans l'historique de la fiche.
- `EMAIL_PROVIDER=resend` : envoi réel.
  1. Créer un compte https://resend.com, ajouter et vérifier votre domaine (enregistrements DNS).
  2. Créer une clé API → `RESEND_API_KEY`.
  3. `EMAIL_FROM="Atelier Sucré <notifications@votre-domaine.fr>"` (adresse du domaine vérifié).
  Sans domaine vérifié, Resend n'autorise l'envoi qu'à l'adresse du titulaire du compte (`onboarding@resend.dev`) : suffisant pour un premier essai où client et pâtissier utilisent cette adresse.

Le service est isolé dans `src/lib/email.ts` : un autre fournisseur (Brevo, Postmark…) se branche au même endroit.

## 3. Vercel

1. Importer le dépôt sur https://vercel.com (framework détecté : Next.js).
2. Variables d'environnement (Production et Preview) : toutes celles de `.env.example`, avec
   `NEXT_PUBLIC_SITE_URL` = l'URL Vercel finale, et `RATE_LIMIT_SALT` = `openssl rand -hex 32`.
3. Déployer, puis reporter l'URL dans Supabase (étape 1.4).
4. Optionnel : `npm run seed` depuis votre poste avec `.env.local` pointant vers le projet de production.

## 4. Stripe en mode test

L'application refuse les clés `sk_live_` : le pilote reste en mode test. Aucune dépense n'est engagée.

1. Tableau de bord Stripe en **mode test** › Développeurs › Clés API : `STRIPE_SECRET_KEY=sk_test_...`
2. **Abonnements au logiciel** : Catalogue de produits › créer « Atelier Sucré Essentiel » (9 €/mois, récurrent) et « Atelier Sucré Pro » (19 €/mois). Copier les identifiants de prix dans `STRIPE_PRICE_ESSENTIEL` et `STRIPE_PRICE_PRO`.
3. **Portail client** : Paramètres › Facturation › Portail client › activer (changement d'offre, résiliation, moyens de paiement).
4. **Webhook** : Développeurs › Webhooks › ajouter l'URL `https://VOTRE-DOMAINE/api/stripe/webhook` avec les événements :
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
   Copier le secret de signature dans `STRIPE_WEBHOOK_SECRET`.
   En local : `stripe listen --forward-to localhost:3000/api/stripe/webhook` (Stripe CLI) donne un secret `whsec_...` temporaire.
5. Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.

**Paiements des clients vers les ateliers (Stripe Connect).** Pendant le pilote, acomptes, soldes et ventes flash sont encaissés en mode test sur le compte Stripe de la plateforme : c'est l'« atelier de démonstration », et l'écran Mon abonnement l'indique. Pour que chaque atelier reçoive ses propres règlements :
- activer Connect sur le compte Stripe de la plateforme (comptes *Express* recommandés) ;
- créer le compte connecté de chaque atelier et son lien d'onboarding (`POST /v1/accounts`, `POST /v1/account_links`) : **non développé** ;
- renseigner `atelier_paiements.stripe_account_id` et `encaissement_actif = true` pour l'atelier : le code ajoute alors `transfer_data[destination]` aux sessions de paiement (`src/lib/stripe.ts`) ;
- décider d'une éventuelle commission (`application_fee_amount`) et des obligations légales (CGV, facturation).

## 5. Tâches planifiées

`/api/cron/rappels` libère les réservations expirées, envoie le rappel « demande sans réponse depuis 24 h » (offre Pro, option activée) et les rappels de retrait du lendemain. Il exige l'en-tête `Authorization: Bearer $CRON_SECRET`.
- Vercel : `vercel.json` le déclare une fois par jour (7 h UTC), limite du plan gratuit. Sur un plan payant, passer à `0 * * * *` (toutes les heures).
- Ailleurs : n'importe quel planificateur (cron-job.org, GitHub Actions…) qui appelle l'URL avec l'en-tête.
Les réservations expirées sont aussi libérées à chaque nouvelle réservation, donc le stock reste juste même sans tâche planifiée.

## Réglages manquants à fournir

| Réglage | Où | Effet si absent |
|---|---|---|
| Clés Supabase | `.env.local` / Vercel | L'application ne démarre pas (message explicite) |
| Redirect URLs Supabase | Supabase > Auth | Les liens de vérification renvoient vers une mauvaise adresse |
| Clé Resend + domaine vérifié | `.env.local` / Vercel | E-mails des demandes simulés (visibles dans les logs et l'historique) |
| SMTP Supabase | Supabase > Auth > SMTP | Vérifications d'e-mail limitées par Supabase |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `.env.local` / Vercel | Paiements simulés en développement ; en production, paiement indisponible sauf `PAIEMENTS_SIMULES=1` |
| `STRIPE_PRICE_ESSENTIEL`, `STRIPE_PRICE_PRO` | `.env.local` / Vercel | Changement d'offre impossible avec Stripe (simulé sans clé) |
| Portail client Stripe | Stripe > Paramètres | « Gérer mon abonnement » renvoie une erreur |
| `CRON_SECRET` + planificateur | Vercel / planificateur | Pas de rappels automatiques |
| Stripe Connect par atelier | Stripe + base | Paiements clients encaissés sur le compte de démonstration |
