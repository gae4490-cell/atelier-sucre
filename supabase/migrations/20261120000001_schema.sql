-- Atelier Sucré — schéma initial (livraison 1 : comptes, vitrine, demandes, notifications)
-- Chaque atelier est isolé par des règles RLS au niveau de la base.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.demande_statut as enum (
  'nouvelle',            -- 1. Demande reçue
  'devis_envoye',        -- 2. Devis envoyé
  'acompte_en_attente',  -- 3. Acompte en attente
  'confirmee',           -- 4. Commande confirmée
  'en_preparation',      -- 5. En préparation
  'prete',               -- 6. Prête au retrait
  'remise',              -- 7. Remise
  'refusee',             -- Déclinée par le pâtissier
  'annulee'              -- Annulée
);

-- ---------------------------------------------------------------------------
-- Ateliers (profil public de la vitrine uniquement : aucune donnée privée ici)
-- ---------------------------------------------------------------------------
create table public.ateliers (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique
                    check (slug ~ '^[a-z0-9]([a-z0-9-]{1,46})[a-z0-9]$' and slug !~ '--'),
  nom               text not null check (char_length(nom) between 2 and 80),
  accroche          text check (char_length(accroche) <= 120),
  description       text check (char_length(description) <= 1500),
  logo_path         text check (char_length(logo_path) <= 300),
  couverture_path   text check (char_length(couverture_path) <= 300),
  zone_retrait      text check (char_length(zone_retrait) <= 200),
  horaires_retrait  text check (char_length(horaires_retrait) <= 300),
  instagram         text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  retrait_actif     boolean not null default true,
  livraison_active  boolean not null default false,
  livraison_note    text check (char_length(livraison_note) <= 300),
  delai_min_jours   integer not null default 3 check (delai_min_jours between 0 and 90),
  afficher_tarifs   boolean not null default false,
  tarifs_note       text check (char_length(tarifs_note) <= 800),
  types_evenement   text[] not null default array['Anniversaire','Mariage','Baptême','Baby shower','Fête d''entreprise','Autre'],
  parfums           text[] not null default array['Chocolat','Vanille','Fraise','Framboise','Citron','Caramel beurre salé','Pistache'],
  publie            boolean not null default false,
  publie_le         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (retrait_actif or livraison_active),
  check (cardinality(types_evenement) <= 20 and cardinality(parfums) <= 30)
);

-- Réglages privés de l'atelier (jamais lisibles publiquement)
create table public.atelier_reglages (
  atelier_id              uuid primary key references public.ateliers(id) on delete cascade,
  email_notifications     text not null check (email_notifications ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telephone               text check (char_length(telephone) <= 30),
  rappel_demande_24h      boolean not null default true,
  rappel_retrait_client   boolean not null default false,
  recap_quotidien         boolean not null default true,
  updated_at              timestamptz not null default now()
);

create table public.atelier_membres (
  atelier_id  uuid not null references public.ateliers(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'proprietaire' check (role in ('proprietaire', 'membre')),
  created_at  timestamptz not null default now(),
  primary key (atelier_id, user_id)
);
create index atelier_membres_user_idx on public.atelier_membres(user_id);

create table public.galerie (
  id              uuid primary key default gen_random_uuid(),
  atelier_id      uuid not null references public.ateliers(id) on delete cascade,
  path            text not null check (char_length(path) <= 300),
  titre           text check (char_length(titre) <= 80),
  prix_indicatif  text check (char_length(prix_indicatif) <= 40),
  position        integer not null default 0,
  created_at      timestamptz not null default now()
);
create index galerie_atelier_idx on public.galerie(atelier_id, position);

create table public.dates_bloquees (
  atelier_id  uuid not null references public.ateliers(id) on delete cascade,
  jour        date not null,
  motif       text check (char_length(motif) <= 120),
  created_at  timestamptz not null default now(),
  primary key (atelier_id, jour)
);

-- ---------------------------------------------------------------------------
-- Demandes clients (insérées uniquement par le serveur, avec la clé service)
-- ---------------------------------------------------------------------------
create table public.demandes (
  id                 uuid primary key default gen_random_uuid(),
  numero             bigint generated always as identity (start with 1001) unique,
  atelier_id         uuid not null references public.ateliers(id) on delete cascade,
  prenom             text not null check (char_length(prenom) between 1 and 60),
  email              text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  telephone          text not null check (char_length(telephone) between 6 and 30),
  date_souhaitee     date not null,
  nb_parts           integer not null check (nb_parts between 1 and 500),
  type_evenement     text check (char_length(type_evenement) <= 60),
  theme              text check (char_length(theme) <= 120),
  parfum             text check (char_length(parfum) <= 60),
  budget_indicatif   text check (char_length(budget_indicatif) <= 40),
  message            text check (char_length(message) <= 2000),
  mode               text not null check (mode in ('retrait', 'livraison')),
  adresse_livraison  text check (char_length(adresse_livraison) <= 300),
  photo_path         text check (char_length(photo_path) <= 300),
  statut             public.demande_statut not null default 'nouvelle',
  note_privee        text check (char_length(note_privee) <= 4000),
  lue_le             timestamptz,
  cle_idempotence    uuid not null unique,
  ip_hash            text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index demandes_atelier_created_idx on public.demandes(atelier_id, created_at desc);
create index demandes_atelier_date_idx on public.demandes(atelier_id, date_souhaitee);

-- ---------------------------------------------------------------------------
-- Notifications dans l'application et historique des e-mails
-- ---------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  atelier_id  uuid not null references public.ateliers(id) on delete cascade,
  demande_id  uuid references public.demandes(id) on delete cascade,
  type        text not null,
  titre       text not null,
  corps       text,
  lien        text,
  lue_le      timestamptz,
  dedupe_key  text not null unique,
  created_at  timestamptz not null default now()
);
create index notifications_atelier_idx on public.notifications(atelier_id, created_at desc);

create table public.emails (
  id              uuid primary key default gen_random_uuid(),
  atelier_id      uuid references public.ateliers(id) on delete cascade,
  demande_id      uuid references public.demandes(id) on delete cascade,
  type            text not null,
  destinataire    text not null,
  sujet           text not null,
  statut          text not null default 'en_attente' check (statut in ('en_attente', 'envoye', 'simule', 'echec')),
  erreur          text,
  fournisseur_id  text,
  tentatives      integer not null default 0,
  dedupe_key      text not null unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index emails_demande_idx on public.emails(demande_id);

-- Compteurs anti-abus (utilisés uniquement par le serveur)
create table public.rate_limits (
  cle       text not null,
  fenetre   timestamptz not null,
  compteur  integer not null default 0,
  primary key (cle, fenetre)
);

-- ---------------------------------------------------------------------------
-- Déclencheurs updated_at
-- ---------------------------------------------------------------------------
create function public.tg_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger ateliers_updated_at before update on public.ateliers
  for each row execute function public.tg_updated_at();
create trigger reglages_updated_at before update on public.atelier_reglages
  for each row execute function public.tg_updated_at();
create trigger demandes_updated_at before update on public.demandes
  for each row execute function public.tg_updated_at();
create trigger emails_updated_at before update on public.emails
  for each row execute function public.tg_updated_at();

-- Date de première publication
create function public.tg_ateliers_publie() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.publie and new.publie_le is null then
    new.publie_le := now();
  end if;
  return new;
end $$;
create trigger ateliers_publie before insert or update of publie on public.ateliers
  for each row execute function public.tg_ateliers_publie();

-- ---------------------------------------------------------------------------
-- Fonctions d'accès
-- ---------------------------------------------------------------------------
create function public.est_membre(p_atelier uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_atelier is not null and exists (
    select 1 from public.atelier_membres m
    where m.atelier_id = p_atelier and m.user_id = auth.uid()
  );
$$;

-- Extrait l'identifiant d'atelier du premier dossier d'un chemin de stockage.
create function public.atelier_du_chemin(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

create function public.slug_disponible(p_slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.ateliers where slug = lower(p_slug));
$$;

-- Création d'un atelier par un pâtissier connecté (atelier + appartenance + réglages).
create function public.creer_atelier(p_nom text, p_slug text, p_email text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'non_authentifie' using errcode = '42501';
  end if;
  if exists (select 1 from public.atelier_membres where user_id = v_uid) then
    raise exception 'atelier_existant' using errcode = 'P0001';
  end if;
  begin
    insert into public.ateliers (nom, slug)
    values (trim(p_nom), lower(trim(p_slug)))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'slug_pris' using errcode = 'P0001';
  end;
  insert into public.atelier_membres (atelier_id, user_id, role) values (v_id, v_uid, 'proprietaire');
  insert into public.atelier_reglages (atelier_id, email_notifications) values (v_id, trim(p_email));
  return v_id;
end $$;

-- Limiteur de débit à fenêtre fixe. Renvoie false si le quota est dépassé.
create function public.consommer_quota(p_cle text, p_max integer, p_fenetre_secondes integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_debut timestamptz := to_timestamp(floor(extract(epoch from now()) / p_fenetre_secondes) * p_fenetre_secondes);
  v_compteur integer;
begin
  insert into public.rate_limits (cle, fenetre, compteur) values (p_cle, v_debut, 1)
  on conflict (cle, fenetre) do update set compteur = public.rate_limits.compteur + 1
  returning compteur into v_compteur;
  if random() < 0.02 then
    delete from public.rate_limits where fenetre < now() - interval '2 days';
  end if;
  return v_compteur <= p_max;
end $$;

-- ---------------------------------------------------------------------------
-- Droits : on part de zéro puis on accorde le strict nécessaire
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.ateliers to anon, authenticated;
grant update (nom, slug, accroche, description, logo_path, couverture_path, zone_retrait,
              horaires_retrait, instagram, retrait_actif, livraison_active, livraison_note,
              delai_min_jours, afficher_tarifs, tarifs_note, types_evenement, parfums, publie)
  on public.ateliers to authenticated;

grant select on public.atelier_reglages to authenticated;
grant update (email_notifications, telephone, rappel_demande_24h, rappel_retrait_client, recap_quotidien)
  on public.atelier_reglages to authenticated;

grant select on public.atelier_membres to authenticated;

grant select on public.galerie to anon, authenticated;
grant insert, update, delete on public.galerie to authenticated;

grant select, insert, delete on public.dates_bloquees to authenticated;

grant select on public.demandes to authenticated;
grant update (statut, note_privee, lue_le) on public.demandes to authenticated;

grant select on public.notifications to authenticated;
grant update (lue_le) on public.notifications to authenticated;

grant select on public.emails to authenticated;

grant execute on function public.est_membre(uuid) to anon, authenticated;
grant execute on function public.atelier_du_chemin(text) to anon, authenticated;
grant execute on function public.slug_disponible(text) to authenticated;
grant execute on function public.creer_atelier(text, text, text) to authenticated;
-- consommer_quota : réservé au rôle service (serveur)
grant execute on function public.consommer_quota(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.ateliers          enable row level security;
alter table public.atelier_reglages  enable row level security;
alter table public.atelier_membres   enable row level security;
alter table public.galerie           enable row level security;
alter table public.dates_bloquees    enable row level security;
alter table public.demandes          enable row level security;
alter table public.notifications     enable row level security;
alter table public.emails            enable row level security;
alter table public.rate_limits       enable row level security;

create policy ateliers_lecture on public.ateliers for select
  using (publie or public.est_membre(id));
create policy ateliers_modif on public.ateliers for update to authenticated
  using (public.est_membre(id)) with check (public.est_membre(id));

create policy reglages_lecture on public.atelier_reglages for select to authenticated
  using (public.est_membre(atelier_id));
create policy reglages_modif on public.atelier_reglages for update to authenticated
  using (public.est_membre(atelier_id)) with check (public.est_membre(atelier_id));

create policy membres_lecture on public.atelier_membres for select to authenticated
  using (user_id = auth.uid() or public.est_membre(atelier_id));

create policy galerie_lecture on public.galerie for select
  using (
    public.est_membre(atelier_id)
    or exists (select 1 from public.ateliers a where a.id = atelier_id and a.publie)
  );
create policy galerie_ajout on public.galerie for insert to authenticated
  with check (public.est_membre(atelier_id) and public.atelier_du_chemin(path) = atelier_id);
create policy galerie_modif on public.galerie for update to authenticated
  using (public.est_membre(atelier_id))
  with check (public.est_membre(atelier_id) and public.atelier_du_chemin(path) = atelier_id);
create policy galerie_suppr on public.galerie for delete to authenticated
  using (public.est_membre(atelier_id));

create policy dates_lecture on public.dates_bloquees for select to authenticated
  using (public.est_membre(atelier_id));
create policy dates_ajout on public.dates_bloquees for insert to authenticated
  with check (public.est_membre(atelier_id));
create policy dates_suppr on public.dates_bloquees for delete to authenticated
  using (public.est_membre(atelier_id));

create policy demandes_lecture on public.demandes for select to authenticated
  using (public.est_membre(atelier_id));
create policy demandes_modif on public.demandes for update to authenticated
  using (public.est_membre(atelier_id)) with check (public.est_membre(atelier_id));

create policy notifications_lecture on public.notifications for select to authenticated
  using (public.est_membre(atelier_id));
create policy notifications_modif on public.notifications for update to authenticated
  using (public.est_membre(atelier_id)) with check (public.est_membre(atelier_id));

create policy emails_lecture on public.emails for select to authenticated
  using (public.est_membre(atelier_id));

-- rate_limits : aucune politique => inaccessible hors rôle service.

-- ---------------------------------------------------------------------------
-- Temps réel : la cloche de notifications se met à jour sans recharger
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
