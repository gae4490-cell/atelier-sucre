-- Tests d'isolation entre deux ateliers. Toute assertion fausse lève une exception.
\set ON_ERROR_STOP on
grant all on all tables in schema public to service_role;
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@test.fr'),
                              ('22222222-2222-2222-2222-222222222222','b@test.fr');

-- Le pâtissier A crée son atelier via la fonction
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select public.creer_atelier('Atelier A','atelier-a','a@test.fr') as a_id \gset
-- Deuxième atelier pour le même compte : refusé
do $$ begin
  perform public.creer_atelier('Encore','encore-a','a@test.fr');
  raise exception 'ECHEC: second atelier accepté';
exception when others then
  if sqlerrm <> 'atelier_existant' then raise; end if;
end $$;

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
-- Slug déjà pris
do $$ begin
  perform public.creer_atelier('Copie','atelier-a','b@test.fr');
  raise exception 'ECHEC: slug dupliqué accepté';
exception when others then
  if sqlerrm <> 'slug_pris' then raise; end if;
end $$;
select public.creer_atelier('Atelier B','atelier-b','b@test.fr') as b_id \gset
reset role;

-- Le serveur (rôle service) insère une demande pour chaque atelier
set role service_role;
insert into public.demandes (atelier_id, prenom, email, telephone, date_souhaitee, nb_parts, mode, cle_idempotence, photo_path)
values (:'a_id','Lina','lina@test.fr','0612345678', current_date + 10, 15, 'retrait', gen_random_uuid(), :'a_id' || '/x/photo.jpg')
returning id as demande_a \gset
insert into public.demandes (atelier_id, prenom, email, telephone, date_souhaitee, nb_parts, mode, cle_idempotence)
values (:'b_id','Tom','tom@test.fr','0612345679', current_date + 10, 8, 'retrait', gen_random_uuid());
insert into public.notifications (atelier_id, demande_id, type, titre, dedupe_key) values (:'a_id', :'demande_a', 'nouvelle_demande', 'Nouvelle demande', 'n1');
insert into storage.objects (bucket_id, name) values ('inspirations', :'a_id' || '/x/photo.jpg');
select public.consommer_quota('t', 2, 60) and public.consommer_quota('t', 2, 60) and not public.consommer_quota('t', 2, 60) as quota_ok \gset
reset role;
\if :quota_ok \else \echo 'ECHEC quota' \quit \endif

-- Pâtissier B : ne voit ni la demande, ni la notification, ni la photo de A
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ declare n int; begin
  select count(*) into n from public.demandes; if n <> 1 then raise exception 'ECHEC: B voit % demandes', n; end if;
  select count(*) into n from public.demandes where prenom = 'Lina'; if n <> 0 then raise exception 'ECHEC: B voit la demande de A'; end if;
  select count(*) into n from public.notifications; if n <> 0 then raise exception 'ECHEC: B voit les notifications de A'; end if;
  select count(*) into n from storage.objects where bucket_id='inspirations'; if n <> 0 then raise exception 'ECHEC: B voit la photo de A'; end if;
  select count(*) into n from public.atelier_reglages; if n <> 1 then raise exception 'ECHEC: réglages visibles: %', n; end if;
  -- Ateliers non publiés : B ne voit que le sien
  select count(*) into n from public.ateliers; if n <> 1 then raise exception 'ECHEC: B voit % ateliers', n; end if;
end $$;
-- B tente de modifier la demande de A : aucune ligne touchée
update public.demandes set note_privee = 'pirate' where prenom = 'Lina';
-- B ne peut pas insérer de demande ni de fichier dans le dossier de A
do $$ begin
  insert into public.demandes (atelier_id, prenom, email, telephone, date_souhaitee, nb_parts, mode, cle_idempotence)
  values ((select id from public.ateliers limit 1),'X','x@x.fr','0600000000',current_date,1,'retrait',gen_random_uuid());
  raise exception 'ECHEC: insertion directe de demande autorisée';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('vitrines', (select a.id from public.ateliers a where a.slug='atelier-b')::text || '/ok.jpg');
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
\set ON_ERROR_STOP off
insert into storage.objects (bucket_id, name) values ('vitrines', :'a_id' || '/pirate.jpg');
\set ON_ERROR_STOP on
reset role;
do $$ declare n int; begin
  select count(*) into n from storage.objects where name like '%pirate%'; if n <> 0 then raise exception 'ECHEC: upload dans le dossier de A'; end if;
  select count(*) into n from public.demandes where note_privee = 'pirate'; if n <> 0 then raise exception 'ECHEC: B a modifié la demande de A'; end if;
end $$;

-- Pâtissier A : voit sa demande, sa photo, peut écrire une note, ne peut pas changer l'e-mail client
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ declare n int; begin
  select count(*) into n from public.demandes where prenom='Lina'; if n <> 1 then raise exception 'ECHEC: A ne voit pas sa demande'; end if;
  select count(*) into n from storage.objects where bucket_id='inspirations'; if n <> 1 then raise exception 'ECHEC: A ne voit pas sa photo'; end if;
  update public.demandes set note_privee = 'Prévoir fusée en sucre' where prenom='Lina';
  update public.notifications set lue_le = now();
end $$;
\set ON_ERROR_STOP off
update public.demandes set email = 'autre@test.fr';
\set ON_ERROR_STOP on

-- Publication : un visiteur anonyme voit l'atelier A publié, pas B
update public.ateliers set publie = true where slug='atelier-a';
reset role;
set role anon;
select set_config('request.jwt.claim.sub','', false);
do $$ declare n int; begin
  select count(*) into n from public.ateliers; if n <> 1 then raise exception 'ECHEC: anon voit % ateliers', n; end if;
  select count(*) into n from public.ateliers where slug='atelier-a' and publie_le is not null; if n <> 1 then raise exception 'ECHEC: publie_le non renseigné'; end if;
end $$;
\set ON_ERROR_STOP off
select count(*) from public.demandes;
select count(*) from public.atelier_reglages;
\set ON_ERROR_STOP on
reset role;
do $$ declare n int; begin
  select count(*) into n from public.demandes where note_privee='Prévoir fusée en sucre' and email='lina@test.fr'; if n <> 1 then raise exception 'ECHEC: note A'; end if;
end $$;

-- Galerie, e-mails, dates bloquées
set role service_role;
insert into public.emails (atelier_id, demande_id, type, destinataire, sujet, dedupe_key, statut) values (:'a_id', :'demande_a', 'alerte_patissier', 'a@test.fr', 'x', 'e1', 'echec');
insert into public.dates_bloquees (atelier_id, jour, motif) values (:'a_id', current_date + 5, 'Congés privés');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ declare n int; begin
  select count(*) into n from public.emails; if n <> 0 then raise exception 'ECHEC: B voit les e-mails de A'; end if;
  select count(*) into n from public.dates_bloquees; if n <> 0 then raise exception 'ECHEC: B voit les dates de A'; end if;
end $$;
-- B tente d'ajouter une photo de galerie chez A, ou chez lui avec un fichier de A
\set ON_ERROR_STOP off
insert into public.galerie (atelier_id, path) values (:'a_id', :'a_id' || '/g.jpg');
insert into public.galerie (atelier_id, path) select id, :'a_id' || '/g.jpg' from public.ateliers where slug='atelier-b';
\set ON_ERROR_STOP on
insert into public.galerie (atelier_id, path) select id, id::text || '/g.jpg' from public.ateliers where slug='atelier-b';
reset role;
do $$ declare n int; begin
  select count(*) into n from public.galerie; if n <> 1 then raise exception 'ECHEC: galerie % lignes (attendu 1)', n; end if;
end $$;
-- Visiteur anonyme : galerie de B (non publié) invisible, dates bloquées et e-mails interdits
set role anon;
select set_config('request.jwt.claim.sub','', false);
do $$ declare n int; begin
  select count(*) into n from public.galerie; if n <> 0 then raise exception 'ECHEC: anon voit la galerie d''un atelier non publié'; end if;
end $$;
\set ON_ERROR_STOP off
select count(*) from public.dates_bloquees;
select count(*) from public.emails;
select public.consommer_quota('x', 1, 60);
\set ON_ERROR_STOP on
reset role;
\echo 'RLS_OK'
