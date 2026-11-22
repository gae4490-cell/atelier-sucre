-- Scénarios Lina (devis 80 €, acompte 25 €) et Sarah (vente flash 12 box), cas limites et isolation.
\set ON_ERROR_STOP on
create function pg_temp.erreur(p_sql text, p_attendu text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ECHEC: "%" aurait dû échouer avec %', left(p_sql, 80), p_attendu;
exception when others then
  if sqlerrm not like '%' || p_attendu || '%' then raise exception 'ECHEC: "%" -> % (attendu %)', left(p_sql, 80), sqlerrm, p_attendu; end if;
end $$;
create function pg_temp.verifier(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin if not coalesce(p_cond, false) then raise exception 'ECHEC: %', p_msg; end if; end $$;

insert into auth.users values ('33333333-3333-3333-3333-333333333333','sarah@test.fr'),
                              ('44444444-4444-4444-4444-444444444444','d@test.fr');

-- Sarah crée et publie son atelier
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select public.suggerer_slug('atelier-a') as suggestion \gset
select pg_temp.verifier(:'suggestion' = 'atelier-a-2', 'suggestion de lien : ' || :'suggestion');
select public.creer_atelier('Les gâteaux de Sarah','les-gateaux-de-sarah','sarah@test.fr') as s_id \gset
update public.ateliers set publie = true, ville = 'Lyon', zone_retrait = 'Lyon 7e' where id = :'s_id';
select pg_temp.verifier(public.offre_active(:'s_id') = 'essentiel', 'offre par défaut');
reset role;

-- Lien modifié après publication : l'ancien est conservé et réservé
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
update public.ateliers set slug = 'sarah-patisserie' where id = :'s_id';
update public.ateliers set slug = 'les-gateaux-de-sarah' where id = :'s_id';
update public.ateliers set slug = 'sarah-patisserie' where id = :'s_id';
reset role;
select pg_temp.verifier((select count(*) from public.slug_historique where atelier_id = :'s_id' and slug = 'les-gateaux-de-sarah') = 1, 'historique du lien');
select pg_temp.verifier(not public.slug_disponible('les-gateaux-de-sarah'), 'ancien lien réservé');

-- Demandes de Lina et Tom (déposées par le serveur)
set role service_role;
insert into public.demandes (atelier_id, prenom, email, telephone, date_souhaitee, nb_parts, mode, theme, parfum, cle_idempotence, source)
values (:'s_id','Lina','lina@test.fr','33612345678', current_date + 14, 15, 'retrait', 'Espace', 'Chocolat', gen_random_uuid(), 'instagram')
returning id as lina \gset
insert into public.demandes (atelier_id, prenom, email, telephone, date_souhaitee, nb_parts, mode, cle_idempotence)
values (:'s_id','Tom','tom@test.fr','33600000001', current_date + 20, 8, 'retrait', gen_random_uuid()) returning id as tom \gset
select pg_temp.verifier(public.demandes_du_mois(:'s_id') = 2, 'compteur de demandes du mois');
reset role;

-- Devis en Essentiel : brouillon possible, envoi refusé
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
insert into public.devis (atelier_id, demande_id, description, total_cents, acompte_cents, valide_jusqu)
values (:'s_id', :'lina', 'Gâteau thème espace, chocolat, 15 parts', 8000, 2500, current_date + 7) returning id as d1 \gset
select pg_temp.erreur(format('select public.envoyer_devis(%L, %L)', :'d1', repeat('a', 64)), 'offre_pro_requise');
-- Montant d'acompte supérieur au total refusé
select pg_temp.erreur(format('update public.devis set acompte_cents = 9000 where id = %L', :'d1'), 'check');
reset role;
update public.abonnements set offre = 'pro', statut = 'simule' where atelier_id = :'s_id';

set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select public.envoyer_devis(:'d1', repeat('a', 64));
-- Devis envoyé : plus modifiable (RLS)
update public.devis set total_cents = 1 where id = :'d1';
select pg_temp.verifier((select total_cents from public.devis where id = :'d1') = 8000, 'devis envoyé figé');
-- Nouveau devis : le premier est remplacé
insert into public.devis (atelier_id, demande_id, description, total_cents, acompte_cents, valide_jusqu)
values (:'s_id', :'lina', 'Gâteau thème espace, chocolat, 15 parts', 8000, 2500, current_date + 7) returning id as d2 \gset
select public.envoyer_devis(:'d2', repeat('b', 64));
select pg_temp.verifier((select statut from public.devis where id = :'d1') = 'remplace', 'devis remplacé');
-- Devis de Tom, qui expirera
insert into public.devis (atelier_id, demande_id, description, total_cents, acompte_cents, valide_jusqu)
values (:'s_id', :'tom', 'Fraisier', 4000, 0, current_date) returning id as d3 \gset
select public.envoyer_devis(:'d3', repeat('c', 64));
reset role;

set role service_role;
select pg_temp.erreur(format('select * from public.repondre_devis(%L, true)', repeat('a', 64)), 'devis_indisponible');
select pg_temp.erreur(format('select * from public.preparer_paiement_acompte(%L)', repeat('a', 64)), 'devis_non_payable');
update public.devis set valide_jusqu = current_date - 1 where id = :'d3';
select pg_temp.verifier((select statut from public.repondre_devis(repeat('c', 64), true)) = 'expire', 'réponse sur devis expiré');
select pg_temp.erreur(format('select * from public.preparer_paiement_acompte(%L)', repeat('c', 64)), 'devis_non_payable');
select pg_temp.verifier((select statut from public.devis where id = :'d3') = 'expire', 'statut expiré');

-- Lina accepte (double clic : même résultat), acompte attendu
select * from public.repondre_devis(repeat('b', 64), true);
select pg_temp.verifier((select statut from public.repondre_devis(repeat('b', 64), true)) = 'accepte', 'réponse idempotente');
select pg_temp.verifier((select statut from public.demandes where id = :'lina') = 'acompte_en_attente', 'acompte en attente');
select pg_temp.verifier(not exists (select 1 from public.commandes where devis_id = :'d2'), 'pas de commande avant paiement');

-- Paiement abandonné
select paiement_id as p1 from public.preparer_paiement_acompte(repeat('b', 64)) \gset
update public.paiements set checkout_session_id = 'cs_1', checkout_url = 'https://pay/1', checkout_expire_le = now() + interval '30 min' where id = :'p1';
select pg_temp.verifier((select existant from public.preparer_paiement_acompte(repeat('b', 64))), 'session réutilisée');
select public.annuler_paiement(null, 'cs_1', 'expire');
select pg_temp.verifier((select statut from public.paiements where id = :'p1') = 'expire', 'paiement abandonné');
select pg_temp.verifier(not exists (select 1 from public.commandes where devis_id = :'d2'), 'abandon : aucune commande');

-- Nouveau paiement, montant falsifié refusé, puis webhook reçu deux fois
select paiement_id as p2, montant_cents as m2 from public.preparer_paiement_acompte(repeat('b', 64)) \gset
select pg_temp.verifier(:m2 = 2500, 'acompte calculé depuis le devis');
update public.paiements set checkout_session_id = 'cs_2', checkout_url = 'https://pay/2' where id = :'p2';
select pg_temp.erreur('select * from public.confirmer_paiement(null, ''cs_2'', ''pi_2'', 100)', 'montant_incoherent');
select resultat as r1 from public.confirmer_paiement(null, 'cs_2', 'pi_2', 2500) \gset
select resultat as r2 from public.confirmer_paiement(null, 'cs_2', 'pi_2', 2500) \gset
select pg_temp.verifier(:'r1' = 'confirme' and :'r2' = 'deja_traite', 'idempotence webhook');
select pg_temp.verifier((select count(*) from public.commandes where devis_id = :'d2') = 1, 'une seule commande');
select pg_temp.verifier((select count(*) from public.notifications where type = 'acompte_recu') = 1, 'une seule alerte');
select pg_temp.erreur(format('select * from public.preparer_paiement_acompte(%L)', repeat('b', 64)), 'acompte_deja_paye');
reset role;

-- Sarah voit 25 € reçus, 55 € restants, commande au bon jour
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select id as c1, paye_cents, reste_cents, date_retrait, statut from public.commandes_suivi where devis_id = :'d2' \gset
select pg_temp.verifier(:paye_cents = 2500 and :reste_cents = 5500, 'acompte 25 € / solde 55 €');
select pg_temp.verifier(:'date_retrait'::date = current_date + 14 and :'statut' = 'confirmee', 'commande confirmée au bon jour');
select pg_temp.verifier((select statut from public.demandes where id = :'lina') = 'confirmee', 'demande confirmée');
-- Lien de solde puis règlement au retrait
select montant_cents as solde from public.creer_paiement_solde(:'c1', repeat('d', 64)) \gset
select pg_temp.verifier(:solde = 5500, 'lien de solde 55 €');
select pg_temp.erreur(format('select public.enregistrer_reglement(%L, 6000, ''especes'')', :'c1'), 'montant_invalide');
select pg_temp.verifier(public.enregistrer_reglement(:'c1', 5500, 'especes') = 0, 'solde réglé');
select pg_temp.verifier((select reste_cents from public.commandes_suivi where id = :'c1') = 0, 'reste 0');
select pg_temp.verifier((select statut from public.paiements where commande_id = :'c1' and type = 'solde') = 'annule', 'lien de solde annulé après règlement');
update public.commandes set statut = 'remise' where id = :'c1';
reset role;

-- Isolation : un autre atelier ne voit ni n'agit sur les devis, commandes et paiements de Sarah
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444', false);
select public.creer_atelier('Atelier D','atelier-d','d@test.fr') as d_id \gset
select pg_temp.verifier((select count(*) from public.devis) = 0, 'devis isolés');
select pg_temp.verifier((select count(*) from public.commandes_suivi) = 0, 'commandes isolées');
select pg_temp.verifier((select count(*) from public.paiements) = 0, 'paiements isolés');
select pg_temp.verifier((select count(*) from public.abonnements) = 1, 'abonnements isolés');
select pg_temp.erreur(format('select public.envoyer_devis(%L, %L)', :'d1', repeat('e', 64)), 'devis_introuvable');
select pg_temp.erreur(format('select public.enregistrer_reglement(%L, 100, ''especes'')', :'c1'), 'commande_introuvable');
select pg_temp.erreur(format('select * from public.creer_paiement_solde(%L, %L)', :'c1', repeat('f', 64)), 'commande_introuvable');
select pg_temp.erreur(format('insert into public.devis (atelier_id, demande_id, total_cents) values (%L, %L, 100)', :'d_id', :'lina'), 'row-level security');
select pg_temp.erreur('select * from public.confirmer_paiement(null, ''cs_2'', null, null)', 'permission denied');
select pg_temp.erreur(format('update public.ateliers set slug = %L where id = %L', 'les-gateaux-de-sarah', :'d_id'), 'slug_pris');
reset role;

-- ---------------------------------------------------------------------------
-- Ventes flash
-- ---------------------------------------------------------------------------
update public.abonnements set offre = 'essentiel', statut = 'actif' where atelier_id = :'s_id';
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
-- Brouillon possible en Essentiel, publication refusée
insert into public.publications (atelier_id, type, titre, prix_cents, stock_total, categorie)
values (:'s_id', 'vente_flash', 'Box de cupcakes', 1800, 12, 'Cupcakes') returning id as v1 \gset
insert into public.creneaux (atelier_id, publication_id, debut, fin)
values (:'s_id', :'v1', date_trunc('day', now()) + interval '3 days 14 hours', date_trunc('day', now()) + interval '3 days 17 hours') returning id as cr1 \gset
select pg_temp.erreur(format('update public.publications set statut = ''publiee'' where id = %L', :'v1'), 'offre_pro_requise');
-- Une publication classique se publie en Essentiel
insert into public.publications (atelier_id, type, titre, statut, categorie) values (:'s_id', 'creation', 'Layer cake fraise', 'publiee', 'Layer cake') returning id as pc \gset
reset role;

-- Passage à Pro : le brouillon est toujours là et se publie
update public.abonnements set offre = 'pro', statut = 'simule' where atelier_id = :'s_id';
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select pg_temp.verifier((select statut from public.publications where id = :'v1') = 'brouillon', 'brouillon conservé');
update public.publications set statut = 'publiee' where id = :'v1';
select pg_temp.verifier(public.stock_restant(:'v1') = 12, 'stock initial 12');
reset role;

-- Visiteur anonyme : voit les publications en ligne, pas les brouillons
set role anon;
select set_config('request.jwt.claim.sub','', false);
select pg_temp.verifier((select count(*) from public.publications where atelier_id = :'s_id') = 2, 'publications visibles');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
insert into public.publications (atelier_id, type, titre) values (:'s_id', 'sur_commande', 'Brouillon secret') returning id as brouillon \gset
reset role;
set role anon;
select set_config('request.jwt.claim.sub','', false);
select pg_temp.verifier((select count(*) from public.publications where id = :'brouillon') = 0, 'brouillon invisible');
select pg_temp.verifier(public.stock_restant(:'brouillon') is null, 'stock d''un brouillon non exposé');
reset role;

-- Une cliente achète une box : stock 11, commande au calendrier, webhook en double sans effet
set role service_role;
select reservation_id as res1, montant_cents as mr1 from public.reserver_vente(:'v1', :'cr1', 1, 'Chloé', 'chloe@test.fr', '33611111111', 'instagram', gen_random_uuid()) \gset
select pg_temp.verifier(:mr1 = 1800, 'prix calculé par le serveur');
insert into public.paiements (atelier_id, type, reservation_id, montant_cents, checkout_session_id) values (:'s_id', 'vente_flash', :'res1', 1800, 'cs_v1');
select public.confirmer_paiement(null, 'cs_v1', 'pi_v1', 1800);
select public.confirmer_paiement(null, 'cs_v1', 'pi_v1', 1800);
select pg_temp.verifier(public.stock_restant(:'v1') = 11, 'stock 11');
select pg_temp.verifier((select count(*) from public.commandes where reservation_id = :'res1') = 1, 'une commande de vente flash');
select pg_temp.verifier((select date_retrait from public.commandes where reservation_id = :'res1') = (current_date + 3), 'retrait au bon jour');
select pg_temp.verifier((select heure_retrait from public.commandes where reservation_id = :'res1') = '14h00 – 17h00', 'créneau ' || (select heure_retrait from public.commandes where reservation_id = :'res1'));
select pg_temp.verifier((select count(*) from public.notifications where type = 'reservation') = 1, 'une alerte de réservation');
-- Quantité et créneau contrôlés
select pg_temp.erreur(format('select * from public.reserver_vente(%L, %L, 99, ''X'', ''x@x.fr'', ''336'', null, gen_random_uuid())', :'v1', :'cr1'), 'quantite_invalide');
select pg_temp.erreur(format('select * from public.reserver_vente(%L, %L, 1, ''X'', ''x@x.fr'', ''336'', null, gen_random_uuid())', :'v1', gen_random_uuid()), 'creneau_introuvable');

-- Dernière box, réservation expirée puis confirmation tardive
insert into public.publications (atelier_id, type, titre, prix_cents, stock_total) values (:'s_id', 'vente_flash', 'Dernière box', 1800, 1) returning id as v2 \gset
insert into public.creneaux (atelier_id, publication_id, debut, fin) values (:'s_id', :'v2', now() + interval '2 days', now() + interval '2 days 3 hours') returning id as cr2 \gset
update public.publications set statut = 'publiee' where id = :'v2';
select reservation_id as rexp from public.reserver_vente(:'v2', :'cr2', 1, 'Lente', 'l@test.fr', '336', null, gen_random_uuid(), 0) \gset
insert into public.paiements (atelier_id, type, reservation_id, montant_cents, checkout_session_id) values (:'s_id', 'vente_flash', :'rexp', 1800, 'cs_lent');
select pg_temp.verifier(public.stock_restant(:'v2') = 1, 'réservation expirée libérée');
select reservation_id as rok from public.reserver_vente(:'v2', :'cr2', 1, 'Rapide', 'r@test.fr', '336', null, gen_random_uuid()) \gset
select pg_temp.verifier((select statut from public.reservations where id = :'rexp') = 'expiree', 'ancienne réservation expirée');
select pg_temp.erreur(format('select * from public.reserver_vente(%L, %L, 1, ''Trop'', ''t@test.fr'', ''336'', null, gen_random_uuid())', :'v2', :'cr2'), 'stock_insuffisant');
select resultat as tardif from public.confirmer_paiement(null, 'cs_lent', null, 1800) \gset
select pg_temp.verifier(:'tardif' = 'a_rembourser', 'confirmation tardive sans survente');
select pg_temp.verifier(not exists (select 1 from public.commandes where reservation_id = :'rexp'), 'pas de commande en survente');
-- Paiement abandonné : la réservation est libérée
insert into public.paiements (atelier_id, type, reservation_id, montant_cents, checkout_session_id) values (:'s_id', 'vente_flash', :'rok', 1800, 'cs_ok');
select public.annuler_paiement(null, 'cs_ok', 'expire');
select pg_temp.verifier(public.stock_restant(:'v2') = 1, 'stock libéré après abandon');

-- Fin de l'accès Pro : plus de nouvelle réservation, les paiements engagés sont honorés
select reservation_id as rpend from public.reserver_vente(:'v1', :'cr1', 2, 'Engagée', 'e@test.fr', '336', null, gen_random_uuid()) \gset
insert into public.paiements (atelier_id, type, reservation_id, montant_cents, checkout_session_id) values (:'s_id', 'vente_flash', :'rpend', 3600, 'cs_pend');
update public.abonnements set offre = 'pro', statut = 'annule', fin_acces = now() - interval '1 minute' where atelier_id = :'s_id';
select pg_temp.verifier(public.offre_active(:'s_id') = 'essentiel', 'retour en Essentiel');
select pg_temp.erreur(format('select * from public.reserver_vente(%L, %L, 1, ''Nouvelle'', ''n@test.fr'', ''336'', null, gen_random_uuid())', :'v1', :'cr1'), 'vente_suspendue');
select pg_temp.verifier((select resultat from public.confirmer_paiement(null, 'cs_pend', null, 3600)) = 'confirme', 'paiement engagé honoré');
select pg_temp.verifier(public.stock_restant(:'v1') = 9, 'stock 9 après paiement engagé');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
insert into public.publications (atelier_id, type, titre, prix_cents, stock_total) values (:'s_id', 'vente_flash', 'Après Pro', 1000, 5) returning id as v3 \gset
insert into public.creneaux (atelier_id, publication_id, debut, fin) values (:'s_id', :'v3', now() + interval '2 days', now() + interval '2 days 1 hour');
select pg_temp.erreur(format('update public.publications set statut = ''publiee'' where id = %L', :'v3'), 'offre_pro_requise');
select pg_temp.verifier((select count(*) from public.commandes) = 3, 'commandes déjà payées toujours visibles');
select pg_temp.erreur(format('update public.publications set stock_total = 2 where id = %L', :'v1'), 'stock_inferieur_aux_ventes');
reset role;

-- Le pâtissier D ne voit pas les réservations de Sarah
set role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444', false);
select pg_temp.verifier((select count(*) from public.reservations) = 0, 'réservations isolées');
select pg_temp.erreur(format('insert into public.creneaux (atelier_id, publication_id, debut, fin) values (%L, %L, now() + interval ''1 day'', now() + interval ''2 days'')', :'d_id', :'v1'), 'row-level security');
select pg_temp.verifier((select count(*) from public.publications where statut = 'brouillon') = 0, 'brouillons d''autrui invisibles');
reset role;
\echo 'VENTES_OK'
