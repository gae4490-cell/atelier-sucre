-- Atelier Sucré — livraisons 2 à 4 : devis, commandes, paiements, publications, ventes flash, offres.
-- Montants en centimes. Dates de retrait dans le fuseau de l'atelier (Europe/Paris par défaut).
-- Les transitions sensibles (envoi/acceptation de devis, paiements, réservations) passent par des
-- fonctions qui verrouillent les lignes concernées : elles sont idempotentes et sans survente.

-- ---------------------------------------------------------------------------
-- Ateliers : ville, fuseau, contact public, historique des liens
-- ---------------------------------------------------------------------------
alter table public.ateliers
  add column ville          text check (char_length(ville) <= 80),
  add column fuseau         text not null default 'Europe/Paris' check (char_length(fuseau) <= 64),
  add column contact_public text check (char_length(contact_public) <= 120);

grant update (ville, fuseau, contact_public) on public.ateliers to authenticated;

create index ateliers_ville_idx on public.ateliers (lower(ville)) where publie;

-- Liens déjà partagés : l'ancien /p/{slug} redirige vers le nouveau.
create table public.slug_historique (
  slug        text primary key,
  atelier_id  uuid not null references public.ateliers(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.slug_historique enable row level security;
-- aucune politique : lecture par le serveur uniquement

create function public.tg_ateliers_slug() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.slug is distinct from old.slug then
    if exists (select 1 from public.slug_historique h where h.slug = new.slug and h.atelier_id <> new.id) then
      raise exception 'slug_pris' using errcode = '23505';
    end if;
    delete from public.slug_historique where slug = new.slug and atelier_id = new.id;
    if old.publie then
      insert into public.slug_historique (slug, atelier_id) values (old.slug, old.id)
      on conflict (slug) do update set atelier_id = excluded.atelier_id;
    end if;
  end if;
  return new;
end $$;
create trigger ateliers_slug before update of slug on public.ateliers
  for each row execute function public.tg_ateliers_slug();

create or replace function public.slug_disponible(p_slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.ateliers where slug = lower(p_slug))
     and not exists (select 1 from public.slug_historique where slug = lower(p_slug));
$$;

-- Propose une variante libre : base, base-2 … base-20, sinon base + suffixe aléatoire.
create function public.suggerer_slug(p_base text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_base text := left(regexp_replace(lower(p_base), '-+$', ''), 44);
  v text;
begin
  if public.slug_disponible(v_base) then return v_base; end if;
  for i in 2..20 loop
    v := v_base || '-' || i;
    if public.slug_disponible(v) then return v; end if;
  end loop;
  return v_base || '-' || substr(md5(random()::text), 1, 3);
end $$;
grant execute on function public.suggerer_slug(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Abonnements au logiciel (séparés des paiements des gâteaux)
-- ---------------------------------------------------------------------------
create table public.abonnements (
  atelier_id              uuid primary key references public.ateliers(id) on delete cascade,
  offre                   text not null default 'essentiel' check (offre in ('essentiel', 'pro', 'atelier')),
  statut                  text not null default 'actif'
                          check (statut in ('actif', 'essai', 'en_retard', 'incomplet', 'annule', 'simule')),
  fin_acces               timestamptz,
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  updated_at              timestamptz not null default now()
);
create trigger abonnements_updated_at before update on public.abonnements
  for each row execute function public.tg_updated_at();

insert into public.abonnements (atelier_id) select id from public.ateliers on conflict do nothing;

create function public.tg_ateliers_abonnement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.abonnements (atelier_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger ateliers_abonnement after insert on public.ateliers
  for each row execute function public.tg_ateliers_abonnement();

/** Offre réellement active (droits) : 'essentiel', 'pro' ou 'atelier'. */
create function public.offre_active(p_atelier uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when a.offre in ('pro', 'atelier')
       and a.statut in ('actif', 'essai', 'en_retard', 'simule')
       and (a.fin_acces is null or a.fin_acces > now())
      then a.offre else 'essentiel' end
    from public.abonnements a where a.atelier_id = p_atelier
  ), 'essentiel');
$$;

create function public.est_pro(p_atelier uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.offre_active(p_atelier) in ('pro', 'atelier');
$$;

-- Informations Stripe Connect (privées)
create table public.atelier_paiements (
  atelier_id         uuid primary key references public.ateliers(id) on delete cascade,
  stripe_account_id  text unique,
  encaissement_actif boolean not null default false,
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Publications (création passée, sur commande, vente flash)
-- ---------------------------------------------------------------------------
create table public.publications (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  atelier_id    uuid not null references public.ateliers(id) on delete cascade,
  type          text not null check (type in ('creation', 'sur_commande', 'vente_flash')),
  statut        text not null default 'brouillon' check (statut in ('brouillon', 'publiee', 'archivee')),
  titre         text not null default '' check (char_length(titre) <= 90),
  description   text check (char_length(description) <= 2000),
  categorie     text check (char_length(categorie) <= 40),
  prix_cents    integer check (prix_cents is null or prix_cents between 0 and 1000000),
  disponibilite text check (char_length(disponibilite) <= 160),
  stock_total   integer check (stock_total is null or stock_total between 1 and 1000),
  max_par_client integer not null default 5 check (max_par_client between 1 and 50),
  publiee_le    timestamptz,
  archivee_le   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index publications_fil_idx on public.publications (publiee_le desc) where statut = 'publiee';
create index publications_atelier_idx on public.publications (atelier_id, created_at desc);
create trigger publications_updated_at before update on public.publications
  for each row execute function public.tg_updated_at();

create table public.publication_photos (
  id              uuid primary key default gen_random_uuid(),
  publication_id  uuid not null references public.publications(id) on delete cascade,
  atelier_id      uuid not null references public.ateliers(id) on delete cascade,
  path            text not null check (char_length(path) <= 300),
  path_vignette   text check (char_length(path_vignette) <= 300),
  position        integer not null default 0,
  created_at      timestamptz not null default now()
);
create index publication_photos_pub_idx on public.publication_photos (publication_id, position);

create table public.creneaux (
  id              uuid primary key default gen_random_uuid(),
  publication_id  uuid not null references public.publications(id) on delete cascade,
  atelier_id      uuid not null references public.ateliers(id) on delete cascade,
  debut           timestamptz not null,
  fin             timestamptz not null,
  capacite        integer check (capacite is null or capacite between 1 and 1000),
  created_at      timestamptz not null default now(),
  check (fin > debut)
);
create index creneaux_pub_idx on public.creneaux (publication_id, debut);

-- Règles de publication contrôlées par la base (même si l'interface est contournée)
create function public.tg_publications_regles() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_vendus integer;
begin
  if new.statut = 'publiee' then
    if char_length(trim(new.titre)) < 2 then
      raise exception 'titre_requis' using errcode = 'P0001';
    end if;
    if new.type = 'vente_flash' then
      if (tg_op = 'INSERT' or old.statut <> 'publiee') and not public.est_pro(new.atelier_id) then
        raise exception 'offre_pro_requise' using errcode = 'P0001';
      end if;
      if new.prix_cents is null or new.prix_cents < 50 then
        raise exception 'prix_requis' using errcode = 'P0001';
      end if;
      if new.stock_total is null then
        raise exception 'stock_requis' using errcode = 'P0001';
      end if;
      if not exists (select 1 from public.creneaux c where c.publication_id = new.id and c.debut > now()) then
        raise exception 'creneau_requis' using errcode = 'P0001';
      end if;
    end if;
    if new.publiee_le is null then new.publiee_le := now(); end if;
  end if;
  if new.statut = 'archivee' and new.archivee_le is null then new.archivee_le := now(); end if;
  if tg_op = 'UPDATE' and new.type <> old.type and old.publiee_le is not null then
    raise exception 'type_fige' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.type = 'vente_flash' and new.stock_total is distinct from old.stock_total then
    select coalesce(sum(quantite), 0) into v_vendus from public.reservations r
      where r.publication_id = new.id and (r.statut = 'confirmee' or (r.statut = 'en_attente' and r.expire_le > now()));
    if new.stock_total is null or new.stock_total < v_vendus then
      raise exception 'stock_inferieur_aux_ventes' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.publiee_le is not null and new.type = 'vente_flash'
     and new.prix_cents is distinct from old.prix_cents
     and exists (select 1 from public.reservations r where r.publication_id = new.id) then
    raise exception 'prix_fige' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Demandes : publication associée et provenance
-- ---------------------------------------------------------------------------
alter table public.demandes
  add column publication_id uuid references public.publications(id) on delete set null,
  add column source text not null default 'inconnue'
    check (source in ('vitrine', 'decouvrir', 'instagram', 'lien_partage', 'inconnue')),
  add column rappel_envoye_le timestamptz;

-- ---------------------------------------------------------------------------
-- Devis
-- ---------------------------------------------------------------------------
create table public.devis (
  id               uuid primary key default gen_random_uuid(),
  atelier_id       uuid not null references public.ateliers(id) on delete cascade,
  demande_id       uuid not null references public.demandes(id) on delete cascade,
  description      text not null default '' check (char_length(description) <= 3000),
  total_cents      integer not null default 0 check (total_cents between 0 and 10000000),
  acompte_cents    integer not null default 0 check (acompte_cents >= 0),
  valide_jusqu     date,
  date_retrait     date,
  heure_retrait    text check (char_length(heure_retrait) <= 40),
  mode             text not null default 'retrait' check (mode in ('retrait', 'livraison')),
  modalites        text check (char_length(modalites) <= 600),
  statut           text not null default 'brouillon'
                   check (statut in ('brouillon', 'envoye', 'accepte', 'refuse', 'expire', 'revoque', 'remplace')),
  jeton_hash       text unique,
  envoye_le        timestamptz,
  repondu_le       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (acompte_cents <= total_cents)
);
create index devis_demande_idx on public.devis (demande_id, created_at desc);
create index devis_atelier_idx on public.devis (atelier_id, created_at desc);
create trigger devis_updated_at before update on public.devis
  for each row execute function public.tg_updated_at();

-- ---------------------------------------------------------------------------
-- Commandes, réservations, paiements
-- ---------------------------------------------------------------------------
create table public.reservations (
  id               uuid primary key default gen_random_uuid(),
  atelier_id       uuid not null references public.ateliers(id) on delete cascade,
  publication_id   uuid not null references public.publications(id) on delete restrict,
  creneau_id       uuid not null references public.creneaux(id) on delete restrict,
  quantite         integer not null check (quantite between 1 and 50),
  montant_cents    integer not null check (montant_cents >= 0),
  statut           text not null default 'en_attente'
                   check (statut in ('en_attente', 'confirmee', 'expiree', 'annulee', 'a_rembourser')),
  prenom           text not null check (char_length(prenom) between 1 and 60),
  email            text not null check (char_length(email) <= 254),
  telephone        text not null check (char_length(telephone) <= 30),
  source           text not null default 'inconnue',
  expire_le        timestamptz not null,
  cle_idempotence  uuid not null unique,
  created_at       timestamptz not null default now(),
  confirmee_le     timestamptz
);
create index reservations_pub_idx on public.reservations (publication_id, statut);
create index reservations_creneau_idx on public.reservations (creneau_id, statut);

create table public.commandes (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity (start with 5001) unique,
  atelier_id       uuid not null references public.ateliers(id) on delete cascade,
  type             text not null check (type in ('devis', 'vente_flash')),
  demande_id       uuid references public.demandes(id) on delete set null,
  devis_id         uuid unique references public.devis(id) on delete set null,
  reservation_id   uuid unique references public.reservations(id) on delete set null,
  libelle          text not null,
  prenom           text not null,
  email            text not null,
  telephone        text not null,
  total_cents      integer not null check (total_cents >= 0),
  acompte_cents    integer not null default 0,
  statut           text not null default 'confirmee'
                   check (statut in ('confirmee', 'en_preparation', 'prete', 'remise', 'annulee')),
  date_retrait     date,
  heure_retrait    text,
  mode             text not null default 'retrait',
  lieu             text,
  note_interne     text check (char_length(note_interne) <= 2000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index commandes_atelier_date_idx on public.commandes (atelier_id, date_retrait);
create trigger commandes_updated_at before update on public.commandes
  for each row execute function public.tg_updated_at();

create table public.paiements (
  id                  uuid primary key default gen_random_uuid(),
  atelier_id          uuid not null references public.ateliers(id) on delete cascade,
  type                text not null check (type in ('acompte', 'solde', 'vente_flash', 'manuel')),
  devis_id            uuid references public.devis(id) on delete set null,
  commande_id         uuid references public.commandes(id) on delete set null,
  reservation_id      uuid references public.reservations(id) on delete set null,
  montant_cents       integer not null check (montant_cents > 0),
  statut              text not null default 'en_attente'
                      check (statut in ('en_attente', 'paye', 'echoue', 'expire', 'annule')),
  moyen               text not null default 'stripe' check (moyen in ('stripe', 'simulation', 'especes', 'virement', 'carte_sur_place', 'autre')),
  jeton_hash          text unique,
  checkout_session_id text unique,
  checkout_url        text,
  checkout_expire_le  timestamptz,
  payment_intent_id   text,
  paye_le             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index paiements_commande_idx on public.paiements (commande_id);
create index paiements_devis_idx on public.paiements (devis_id);
create trigger paiements_updated_at before update on public.paiements
  for each row execute function public.tg_updated_at();

-- Événements Stripe déjà traités (un événement reçu deux fois n'est traité qu'une fois)
create table public.stripe_evenements (
  id         text primary key,
  type       text not null,
  recu_le    timestamptz not null default now()
);

-- Vue commandes + paiements (soumise au RLS de l'appelant)
create view public.commandes_suivi with (security_invoker = true) as
select c.*,
  coalesce((select sum(p.montant_cents) from public.paiements p where p.commande_id = c.id and p.statut = 'paye'), 0)::integer as paye_cents,
  (c.total_cents - coalesce((select sum(p.montant_cents) from public.paiements p where p.commande_id = c.id and p.statut = 'paye'), 0))::integer as reste_cents
from public.commandes c;

-- Trigger publications (référence reservations : créé après)
create trigger publications_regles before insert or update on public.publications
  for each row execute function public.tg_publications_regles();

-- ---------------------------------------------------------------------------
-- Fonctions : stock et réservations
-- ---------------------------------------------------------------------------
create function public.stock_restant(p_publication uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when p.type <> 'vente_flash' or p.stock_total is null then null else
    greatest(0, p.stock_total - coalesce((
      select sum(r.quantite) from public.reservations r
      where r.publication_id = p.id
        and (r.statut = 'confirmee' or (r.statut = 'en_attente' and r.expire_le > now()))
    ), 0))::integer end
  from public.publications p
  where p.id = p_publication
    and (public.est_membre(p.atelier_id)
         or (p.statut in ('publiee', 'archivee') and exists (select 1 from public.ateliers a where a.id = p.atelier_id and a.publie)));
$$;

create function public.places_creneau(p_creneau uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when c.capacite is null then null else
    greatest(0, c.capacite - coalesce((
      select sum(r.quantite) from public.reservations r
      where r.creneau_id = c.id
        and (r.statut = 'confirmee' or (r.statut = 'en_attente' and r.expire_le > now()))
    ), 0))::integer end
  from public.creneaux c where c.id = p_creneau;
$$;

/**
 * Réserve atomiquement une quantité sur une vente flash pendant le paiement.
 * Le verrou sur la publication sérialise les réservations concurrentes : deux clients
 * ne peuvent pas obtenir la dernière box. Prix calculé ici, jamais fourni par le client.
 */
create function public.reserver_vente(
  p_publication uuid, p_creneau uuid, p_quantite integer,
  p_prenom text, p_email text, p_telephone text, p_source text,
  p_cle uuid, p_duree_minutes integer default 35
) returns table (reservation_id uuid, montant_cents integer, expire_le timestamptz, deja boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_pub public.publications%rowtype;
  v_creneau public.creneaux%rowtype;
  v_existante public.reservations%rowtype;
  v_pris integer;
  v_pris_creneau integer;
  v_id uuid;
  v_expire timestamptz := now() + make_interval(mins => p_duree_minutes);
begin
  select * into v_existante from public.reservations r where r.cle_idempotence = p_cle;
  if found then
    return query select v_existante.id, v_existante.montant_cents, v_existante.expire_le, true;
    return;
  end if;

  select * into v_pub from public.publications where id = p_publication for update;
  if not found or v_pub.type <> 'vente_flash' then raise exception 'vente_introuvable' using errcode = 'P0001'; end if;
  if v_pub.statut <> 'publiee' or not exists (select 1 from public.ateliers a where a.id = v_pub.atelier_id and a.publie) then
    raise exception 'vente_fermee' using errcode = 'P0001';
  end if;
  if not public.est_pro(v_pub.atelier_id) then raise exception 'vente_suspendue' using errcode = 'P0001'; end if;
  if p_quantite < 1 or p_quantite > v_pub.max_par_client then raise exception 'quantite_invalide' using errcode = 'P0001'; end if;

  select * into v_creneau from public.creneaux where id = p_creneau and publication_id = p_publication;
  if not found then raise exception 'creneau_introuvable' using errcode = 'P0001'; end if;
  if v_creneau.debut <= now() then raise exception 'creneau_passe' using errcode = 'P0001'; end if;

  -- Libère les réservations dont la durée est écoulée (le paiement Stripe expire avant).
  update public.reservations set statut = 'expiree'
    where publication_id = p_publication and statut = 'en_attente' and expire_le <= now();

  select coalesce(sum(quantite), 0) into v_pris from public.reservations
    where publication_id = p_publication and statut in ('confirmee', 'en_attente');
  if v_pris + p_quantite > v_pub.stock_total then raise exception 'stock_insuffisant' using errcode = 'P0001'; end if;

  if v_creneau.capacite is not null then
    select coalesce(sum(quantite), 0) into v_pris_creneau from public.reservations
      where creneau_id = p_creneau and statut in ('confirmee', 'en_attente');
    if v_pris_creneau + p_quantite > v_creneau.capacite then raise exception 'creneau_complet' using errcode = 'P0001'; end if;
  end if;

  insert into public.reservations (atelier_id, publication_id, creneau_id, quantite, montant_cents, prenom, email, telephone, source, expire_le, cle_idempotence)
  values (v_pub.atelier_id, p_publication, p_creneau, p_quantite, v_pub.prix_cents * p_quantite, p_prenom, p_email, p_telephone,
          coalesce(nullif(p_source, ''), 'inconnue'), v_expire, p_cle)
  returning id into v_id;

  return query select v_id, v_pub.prix_cents * p_quantite, v_expire, false;
end $$;

create function public.liberer_reservations_expirees() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.reservations set statut = 'expiree' where statut = 'en_attente' and expire_le <= now();
  get diagnostics n = row_count;
  update public.paiements p set statut = 'expire'
    where p.statut = 'en_attente' and p.checkout_expire_le is not null and p.checkout_expire_le <= now();
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Fonctions : devis
-- ---------------------------------------------------------------------------
create function public.aujourdhui_atelier(p_atelier uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select fuseau from public.ateliers where id = p_atelier), 'Europe/Paris'))::date;
$$;

/** Envoi d'un devis par un membre : brouillon -> envoyé ; les devis précédents envoyés sont remplacés. */
create function public.envoyer_devis(p_devis uuid, p_jeton_hash text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.devis%rowtype;
begin
  select * into v from public.devis where id = p_devis for update;
  if not found or not public.est_membre(v.atelier_id) then raise exception 'devis_introuvable' using errcode = 'P0001'; end if;
  if v.statut <> 'brouillon' then raise exception 'devis_deja_envoye' using errcode = 'P0001'; end if;
  if not public.est_pro(v.atelier_id) then raise exception 'offre_pro_requise' using errcode = 'P0001'; end if;
  if v.total_cents <= 0 then raise exception 'prix_requis' using errcode = 'P0001'; end if;
  if v.valide_jusqu is null or v.valide_jusqu < public.aujourdhui_atelier(v.atelier_id) then
    raise exception 'validite_invalide' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_jeton_hash, '')) < 32 then raise exception 'jeton_invalide' using errcode = 'P0001'; end if;

  update public.devis set statut = 'remplace'
    where demande_id = v.demande_id and id <> v.id and statut = 'envoye';
  -- les paiements en cours sur les devis remplacés ne sont plus utilisables
  update public.paiements set statut = 'annule'
    where statut = 'en_attente' and devis_id in (select id from public.devis where demande_id = v.demande_id and statut = 'remplace');

  update public.devis set statut = 'envoye', jeton_hash = p_jeton_hash, envoye_le = now() where id = v.id;
  update public.demandes set statut = 'devis_envoye' where id = v.demande_id and statut in ('nouvelle', 'devis_envoye', 'acompte_en_attente');
end $$;

create function public.revoquer_devis(p_devis uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.devis%rowtype;
begin
  select * into v from public.devis where id = p_devis for update;
  if not found or not public.est_membre(v.atelier_id) then raise exception 'devis_introuvable' using errcode = 'P0001'; end if;
  if v.statut not in ('envoye', 'accepte') then raise exception 'devis_non_revocable' using errcode = 'P0001'; end if;
  if exists (select 1 from public.commandes c where c.devis_id = v.id) then raise exception 'commande_existante' using errcode = 'P0001'; end if;
  update public.devis set statut = 'revoque' where id = v.id;
  update public.paiements set statut = 'annule' where devis_id = v.id and statut = 'en_attente';
end $$;

/** Nouveau lien privé pour un devis envoyé (l'ancien cesse de fonctionner). */
create function public.renouveler_lien_devis(p_devis uuid, p_jeton_hash text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.devis%rowtype;
begin
  select * into v from public.devis where id = p_devis for update;
  if not found or not public.est_membre(v.atelier_id) then raise exception 'devis_introuvable' using errcode = 'P0001'; end if;
  if v.statut not in ('envoye', 'accepte') then raise exception 'devis_indisponible' using errcode = 'P0001'; end if;
  if char_length(coalesce(p_jeton_hash, '')) < 32 then raise exception 'jeton_invalide' using errcode = 'P0001'; end if;
  update public.devis set jeton_hash = p_jeton_hash where id = v.id;
end $$;

/** Commande confirmée d'un devis (une seule par devis). Interne. */
create function public._commande_depuis_devis(p_devis uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.devis%rowtype;
  d public.demandes%rowtype;
  a public.ateliers%rowtype;
  v_id uuid;
begin
  select id into v_id from public.commandes where devis_id = p_devis;
  if found then return v_id; end if;
  select * into v from public.devis where id = p_devis;
  select * into d from public.demandes where id = v.demande_id;
  select * into a from public.ateliers where id = v.atelier_id;
  insert into public.commandes (atelier_id, type, demande_id, devis_id, libelle, prenom, email, telephone,
                                total_cents, acompte_cents, date_retrait, heure_retrait, mode, lieu)
  values (v.atelier_id, 'devis', d.id, v.id,
          coalesce(nullif(left(v.description, 80), ''), 'Gâteau sur mesure'),
          d.prenom, d.email, d.telephone, v.total_cents, v.acompte_cents,
          coalesce(v.date_retrait, d.date_souhaitee), v.heure_retrait, v.mode,
          case when v.mode = 'livraison' then d.adresse_livraison else a.zone_retrait end)
  on conflict (devis_id) do nothing
  returning id into v_id;
  if v_id is null then select id into v_id from public.commandes where devis_id = p_devis; end if;
  update public.demandes set statut = 'confirmee' where id = d.id;
  return v_id;
end $$;

/** Réponse du client via le lien privé (appelée par le serveur après vérification du jeton). */
create function public.repondre_devis(p_jeton_hash text, p_accepter boolean)
returns table (devis_id uuid, statut text, commande_id uuid, acompte_cents integer)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v public.devis%rowtype;
  v_cmd uuid;
begin
  select * into v from public.devis where jeton_hash = p_jeton_hash for update;
  if not found then raise exception 'devis_introuvable' using errcode = 'P0001'; end if;
  if v.statut = 'envoye' and v.valide_jusqu < public.aujourdhui_atelier(v.atelier_id) then
    update public.devis set statut = 'expire' where id = v.id;
    return query select v.id, 'expire'::text, null::uuid, v.acompte_cents;
    return;
  end if;
  if v.statut in ('accepte', 'refuse') then
    -- réponse déjà enregistrée (double clic, retour arrière) : on renvoie l'état
    return query select v.id, v.statut, (select c.id from public.commandes c where c.devis_id = v.id), v.acompte_cents;
    return;
  end if;
  if v.statut <> 'envoye' then raise exception 'devis_indisponible' using errcode = 'P0001'; end if;

  if not p_accepter then
    update public.devis set statut = 'refuse', repondu_le = now() where id = v.id;
    return query select v.id, 'refuse'::text, null::uuid, v.acompte_cents;
    return;
  end if;

  update public.devis set statut = 'accepte', repondu_le = now() where id = v.id;
  if v.acompte_cents = 0 then
    v_cmd := public._commande_depuis_devis(v.id);
  else
    update public.demandes set statut = 'acompte_en_attente' where id = v.demande_id;
  end if;
  return query select v.id, 'accepte'::text, v_cmd, v.acompte_cents;
end $$;

/**
 * Prépare le paiement de l'acompte d'un devis accepté. Montant lu dans le devis enregistré.
 * Réutilise un paiement en cours non expiré (pas de double session).
 */
create function public.preparer_paiement_acompte(p_jeton_hash text)
returns table (paiement_id uuid, montant_cents integer, atelier_id uuid, checkout_url text, existant boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v public.devis%rowtype;
  p public.paiements%rowtype;
begin
  select * into v from public.devis where jeton_hash = p_jeton_hash for update;
  if not found then raise exception 'devis_introuvable' using errcode = 'P0001'; end if;
  if v.statut in ('envoye', 'accepte') and v.valide_jusqu < public.aujourdhui_atelier(v.atelier_id) then
    raise exception 'devis_expire' using errcode = 'P0001';
  end if;
  if v.statut <> 'accepte' then raise exception 'devis_non_payable' using errcode = 'P0001'; end if;
  if v.acompte_cents = 0 then raise exception 'aucun_acompte' using errcode = 'P0001'; end if;
  if exists (select 1 from public.paiements x where x.devis_id = v.id and x.type = 'acompte' and x.statut = 'paye') then
    raise exception 'acompte_deja_paye' using errcode = 'P0001';
  end if;
  select * into p from public.paiements x
    where x.devis_id = v.id and x.type = 'acompte' and x.statut = 'en_attente'
      and (x.checkout_expire_le is null or x.checkout_expire_le > now() + interval '2 minutes')
    order by x.created_at desc limit 1;
  if found and p.checkout_url is not null then
    return query select p.id, p.montant_cents, v.atelier_id, p.checkout_url, true;
    return;
  end if;
  insert into public.paiements (atelier_id, type, devis_id, montant_cents)
  values (v.atelier_id, 'acompte', v.id, v.acompte_cents) returning * into p;
  return query select p.id, p.montant_cents, v.atelier_id, null::text, false;
end $$;

/** Lien de paiement du solde, créé par un membre. Montant = reste dû calculé ici. */
create function public.creer_paiement_solde(p_commande uuid, p_jeton_hash text)
returns table (paiement_id uuid, montant_cents integer)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  c public.commandes%rowtype;
  v_reste integer;
  v_id uuid;
begin
  select * into c from public.commandes where id = p_commande for update;
  if not found or not public.est_membre(c.atelier_id) then raise exception 'commande_introuvable' using errcode = 'P0001'; end if;
  if c.statut = 'annulee' then raise exception 'commande_annulee' using errcode = 'P0001'; end if;
  select c.total_cents - coalesce(sum(montant_cents), 0) into v_reste from public.paiements where commande_id = c.id and statut = 'paye';
  if v_reste <= 0 then raise exception 'rien_a_payer' using errcode = 'P0001'; end if;
  update public.paiements set statut = 'annule' where commande_id = c.id and type = 'solde' and statut = 'en_attente';
  insert into public.paiements (atelier_id, type, commande_id, montant_cents, jeton_hash)
  values (c.atelier_id, 'solde', c.id, v_reste, p_jeton_hash) returning id into v_id;
  return query select v_id, v_reste;
end $$;

/** Règlement reçu au retrait (espèces, virement…), saisi par un membre. */
create function public.enregistrer_reglement(p_commande uuid, p_montant_cents integer, p_moyen text)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  c public.commandes%rowtype;
  v_reste integer;
begin
  select * into c from public.commandes where id = p_commande for update;
  if not found or not public.est_membre(c.atelier_id) then raise exception 'commande_introuvable' using errcode = 'P0001'; end if;
  if p_moyen not in ('especes', 'virement', 'carte_sur_place', 'autre') then raise exception 'moyen_invalide' using errcode = 'P0001'; end if;
  select c.total_cents - coalesce(sum(montant_cents), 0) into v_reste from public.paiements where commande_id = c.id and statut = 'paye';
  if p_montant_cents <= 0 or p_montant_cents > v_reste then raise exception 'montant_invalide' using errcode = 'P0001'; end if;
  insert into public.paiements (atelier_id, type, commande_id, montant_cents, statut, moyen, paye_le)
  values (c.atelier_id, 'manuel', c.id, p_montant_cents, 'paye', p_moyen, now());
  update public.paiements set statut = 'annule' where commande_id = c.id and type = 'solde' and statut = 'en_attente';
  return v_reste - p_montant_cents;
end $$;

-- ---------------------------------------------------------------------------
-- Confirmation d'un paiement (webhook Stripe, retour de paiement, simulation)
-- Idempotente : un second appel ne crée ni commande, ni mouvement de stock, ni alerte en plus.
-- ---------------------------------------------------------------------------
create function public.confirmer_paiement(
  p_paiement uuid, p_session text, p_payment_intent text, p_montant_cents integer
) returns table (resultat text, type text, paiement_id uuid, commande_id uuid, atelier_id uuid)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  p public.paiements%rowtype;
  r public.reservations%rowtype;
  pub public.publications%rowtype;
  cr public.creneaux%rowtype;
  a public.ateliers%rowtype;
  v_cmd uuid;
  v_pris integer;
  v_pris_creneau integer;
  v_resultat text := 'confirme';
begin
  if p_session is not null then
    select * into p from public.paiements where checkout_session_id = p_session for update;
  else
    select * into p from public.paiements where id = p_paiement for update;
  end if;
  if not found then raise exception 'paiement_introuvable' using errcode = 'P0001'; end if;

  if p.statut = 'paye' then
    return query select 'deja_traite'::text, p.type, p.id,
      coalesce(p.commande_id, (select c.id from public.commandes c where c.devis_id = p.devis_id or c.reservation_id = p.reservation_id limit 1)),
      p.atelier_id;
    return;
  end if;
  if p_montant_cents is not null and p_montant_cents <> p.montant_cents then
    raise exception 'montant_incoherent' using errcode = 'P0001';
  end if;

  update public.paiements set statut = 'paye', paye_le = now(), payment_intent_id = coalesce(p_payment_intent, payment_intent_id)
    where id = p.id;

  if p.type = 'acompte' then
    v_cmd := public._commande_depuis_devis(p.devis_id);
    update public.paiements set commande_id = v_cmd where id = p.id;
    if exists (select 1 from public.devis d where d.id = p.devis_id and d.statut <> 'accepte') then
      v_resultat := 'confirme_a_verifier'; -- devis remplacé/révoqué entre-temps : argent reçu, à vérifier
    end if;
    insert into public.notifications (atelier_id, demande_id, type, titre, corps, lien, dedupe_key)
    select p.atelier_id, d.demande_id, 'acompte_recu', 'Acompte reçu',
           to_char(p.montant_cents / 100.0, 'FM999G990D00') || ' € reçus',
           '/espace/commandes/' || v_cmd, 'paiement:' || p.id
    from public.devis d where d.id = p.devis_id
    on conflict (dedupe_key) do nothing;

  elsif p.type = 'solde' then
    v_cmd := p.commande_id;
    insert into public.notifications (atelier_id, type, titre, corps, lien, dedupe_key)
    values (p.atelier_id, 'solde_recu', 'Solde reçu', to_char(p.montant_cents / 100.0, 'FM999G990D00') || ' € reçus',
            '/espace/commandes/' || v_cmd, 'paiement:' || p.id)
    on conflict (dedupe_key) do nothing;

  elsif p.type = 'vente_flash' then
    select * into r from public.reservations where id = p.reservation_id for update;
    select * into pub from public.publications where id = r.publication_id for update;
    select * into cr from public.creneaux where id = r.creneau_id;
    select * into a from public.ateliers where id = r.atelier_id;
    if r.statut in ('en_attente', 'expiree') then
      -- confirmation tardive : on vérifie qu'il reste de la place sans compter cette réservation
      select coalesce(sum(quantite), 0) into v_pris from public.reservations x
        where x.publication_id = r.publication_id and x.id <> r.id
          and (x.statut = 'confirmee' or (x.statut = 'en_attente' and x.expire_le > now()));
      if cr.capacite is not null then
        select coalesce(sum(quantite), 0) into v_pris_creneau from public.reservations x
          where x.creneau_id = r.creneau_id and x.id <> r.id
            and (x.statut = 'confirmee' or (x.statut = 'en_attente' and x.expire_le > now()));
      end if;
      if v_pris + r.quantite > pub.stock_total or (cr.capacite is not null and v_pris_creneau + r.quantite > cr.capacite) then
        update public.reservations set statut = 'a_rembourser' where id = r.id;
        v_resultat := 'a_rembourser';
        insert into public.notifications (atelier_id, type, titre, corps, lien, dedupe_key)
        values (r.atelier_id, 'paiement_a_rembourser', 'Paiement à rembourser',
                'Paiement reçu après expiration de la réservation de ' || r.prenom || ' et plus de stock disponible.',
                '/espace/publications/' || pub.id, 'paiement:' || p.id)
        on conflict (dedupe_key) do nothing;
      else
        update public.reservations set statut = 'confirmee', confirmee_le = now() where id = r.id;
      end if;
    end if;
    if v_resultat <> 'a_rembourser' then
      insert into public.commandes (atelier_id, type, reservation_id, libelle, prenom, email, telephone, total_cents,
                                    acompte_cents, date_retrait, heure_retrait, mode, lieu)
      values (r.atelier_id, 'vente_flash', r.id,
              r.quantite || ' × ' || pub.titre, r.prenom, r.email, r.telephone, r.montant_cents, 0,
              (cr.debut at time zone a.fuseau)::date,
              to_char(cr.debut at time zone a.fuseau, 'HH24"h"MI') || ' – ' || to_char(cr.fin at time zone a.fuseau, 'HH24"h"MI'),
              'retrait', a.zone_retrait)
      on conflict (reservation_id) do nothing
      returning id into v_cmd;
      if v_cmd is null then select id into v_cmd from public.commandes where reservation_id = r.id; end if;
      update public.paiements set commande_id = v_cmd where id = p.id;
      insert into public.notifications (atelier_id, type, titre, corps, lien, dedupe_key)
      values (r.atelier_id, 'reservation', 'Nouvelle réservation : ' || pub.titre,
              r.prenom || ' · ' || r.quantite || ' × ' || to_char(pub.prix_cents / 100.0, 'FM999G990D00') || ' €',
              '/espace/commandes/' || v_cmd, 'paiement:' || p.id)
      on conflict (dedupe_key) do nothing;
    end if;
  end if;

  return query select v_resultat, p.type, p.id, v_cmd, p.atelier_id;
end $$;

/** Session de paiement expirée ou abandonnée : rien n'est confirmé, la réservation est libérée. */
create function public.annuler_paiement(p_paiement uuid, p_session text, p_statut text default 'expire')
returns void
language plpgsql security definer set search_path = '' as $$
declare p public.paiements%rowtype;
begin
  if p_session is not null then
    select * into p from public.paiements where checkout_session_id = p_session for update;
  else
    select * into p from public.paiements where id = p_paiement for update;
  end if;
  if not found or p.statut <> 'en_attente' then return; end if;
  update public.paiements set statut = case when p_statut in ('expire', 'echoue', 'annule') then p_statut else 'expire' end where id = p.id;
  if p.reservation_id is not null then
    update public.reservations set statut = 'expiree' where id = p.reservation_id and statut = 'en_attente';
  end if;
end $$;

/** Nombre de nouvelles demandes du mois en cours (fuseau de l'atelier). */
create function public.demandes_du_mois(p_atelier uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.demandes d
  where d.atelier_id = p_atelier
    and (d.created_at at time zone coalesce((select fuseau from public.ateliers where id = p_atelier), 'Europe/Paris'))
        >= date_trunc('month', now() at time zone coalesce((select fuseau from public.ateliers where id = p_atelier), 'Europe/Paris'));
$$;

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------
revoke all on public.slug_historique, public.abonnements, public.atelier_paiements, public.publications,
  public.publication_photos, public.creneaux, public.reservations, public.commandes, public.paiements,
  public.stripe_evenements, public.devis, public.commandes_suivi from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- (ré)accorde les fonctions de la migration 1
grant execute on function public.est_membre(uuid) to anon, authenticated;
grant execute on function public.atelier_du_chemin(text) to anon, authenticated;
grant execute on function public.slug_disponible(text) to authenticated;
grant execute on function public.creer_atelier(text, text, text) to authenticated;
grant execute on function public.suggerer_slug(text) to authenticated;

grant execute on function public.offre_active(uuid) to authenticated;
grant execute on function public.est_pro(uuid) to anon, authenticated;
grant execute on function public.stock_restant(uuid) to anon, authenticated;
grant execute on function public.places_creneau(uuid) to anon, authenticated;
grant execute on function public.envoyer_devis(uuid, text) to authenticated;
grant execute on function public.revoquer_devis(uuid) to authenticated;
grant execute on function public.renouveler_lien_devis(uuid, text) to authenticated;
grant execute on function public.creer_paiement_solde(uuid, text) to authenticated;
grant execute on function public.enregistrer_reglement(uuid, integer, text) to authenticated;
grant execute on function public.demandes_du_mois(uuid) to authenticated;
grant execute on function public.aujourdhui_atelier(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on all functions in schema public to service_role;
    grant all on all tables in schema public to service_role;
  end if;
end $$;

grant select on public.abonnements to authenticated;
grant select on public.atelier_paiements to authenticated;

grant select on public.publications to anon, authenticated;
grant insert (atelier_id, type, statut, titre, description, categorie, prix_cents, disponibilite, stock_total, max_par_client)
  on public.publications to authenticated;
grant update (statut, titre, description, categorie, prix_cents, disponibilite, stock_total, max_par_client, type)
  on public.publications to authenticated;
grant delete on public.publications to authenticated;

grant select on public.publication_photos to anon, authenticated;
grant insert, delete on public.publication_photos to authenticated;
grant update (position) on public.publication_photos to authenticated;

grant select on public.creneaux to anon, authenticated;
grant insert, delete on public.creneaux to authenticated;

grant select on public.devis to authenticated;
grant insert (atelier_id, demande_id, description, total_cents, acompte_cents, valide_jusqu, date_retrait, heure_retrait, mode, modalites)
  on public.devis to authenticated;
grant update (description, total_cents, acompte_cents, valide_jusqu, date_retrait, heure_retrait, mode, modalites)
  on public.devis to authenticated;
grant delete on public.devis to authenticated;

grant select on public.commandes, public.commandes_suivi to authenticated;
grant update (statut, date_retrait, heure_retrait, note_interne) on public.commandes to authenticated;
grant select on public.paiements to authenticated;
grant select on public.reservations to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.abonnements        enable row level security;
alter table public.atelier_paiements  enable row level security;
alter table public.publications       enable row level security;
alter table public.publication_photos enable row level security;
alter table public.creneaux           enable row level security;
alter table public.devis              enable row level security;
alter table public.reservations       enable row level security;
alter table public.commandes          enable row level security;
alter table public.paiements          enable row level security;
alter table public.stripe_evenements  enable row level security;

create policy abonnements_lecture on public.abonnements for select to authenticated using (public.est_membre(atelier_id));
create policy atelier_paiements_lecture on public.atelier_paiements for select to authenticated using (public.est_membre(atelier_id));

create function public.publication_visible(p_publication uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.publications p join public.ateliers a on a.id = p.atelier_id
    where p.id = p_publication and a.publie and p.statut in ('publiee', 'archivee')
  ) or exists (select 1 from public.publications p where p.id = p_publication and public.est_membre(p.atelier_id));
$$;
grant execute on function public.publication_visible(uuid) to anon, authenticated;

-- Les publications archivées restent consultables par lien direct (historique, « Terminée »),
-- mais seules les publiées apparaissent dans le fil et sur la vitrine.
create policy publications_lecture on public.publications for select
  using (public.est_membre(atelier_id)
         or (statut in ('publiee', 'archivee') and exists (select 1 from public.ateliers a where a.id = atelier_id and a.publie)));
create policy publications_ajout on public.publications for insert to authenticated
  with check (public.est_membre(atelier_id));
create policy publications_modif on public.publications for update to authenticated
  using (public.est_membre(atelier_id)) with check (public.est_membre(atelier_id));
create policy publications_suppr on public.publications for delete to authenticated
  using (public.est_membre(atelier_id) and statut = 'brouillon');

create policy photos_pub_lecture on public.publication_photos for select using (public.publication_visible(publication_id));
create policy photos_pub_ajout on public.publication_photos for insert to authenticated
  with check (public.est_membre(atelier_id) and public.atelier_du_chemin(path) = atelier_id
              and exists (select 1 from public.publications p where p.id = publication_photos.publication_id and p.atelier_id = publication_photos.atelier_id));
create policy photos_pub_modif on public.publication_photos for update to authenticated
  using (public.est_membre(atelier_id)) with check (public.est_membre(atelier_id));
create policy photos_pub_suppr on public.publication_photos for delete to authenticated using (public.est_membre(atelier_id));

create policy creneaux_lecture on public.creneaux for select using (public.publication_visible(publication_id));
create policy creneaux_ajout on public.creneaux for insert to authenticated
  with check (public.est_membre(atelier_id)
              and exists (select 1 from public.publications p where p.id = creneaux.publication_id and p.atelier_id = creneaux.atelier_id));
create policy creneaux_suppr on public.creneaux for delete to authenticated
  using (public.est_membre(atelier_id) and not exists (select 1 from public.reservations r where r.creneau_id = creneaux.id));

create policy devis_lecture on public.devis for select to authenticated using (public.est_membre(atelier_id));
create policy devis_ajout on public.devis for insert to authenticated
  with check (public.est_membre(atelier_id) and statut = 'brouillon'
              and exists (select 1 from public.demandes d where d.id = devis.demande_id and d.atelier_id = devis.atelier_id));
create policy devis_modif on public.devis for update to authenticated
  using (public.est_membre(atelier_id) and statut = 'brouillon')
  with check (public.est_membre(atelier_id) and statut = 'brouillon');
create policy devis_suppr on public.devis for delete to authenticated
  using (public.est_membre(atelier_id) and statut = 'brouillon');

create policy reservations_lecture on public.reservations for select to authenticated using (public.est_membre(atelier_id));
create policy commandes_lecture on public.commandes for select to authenticated using (public.est_membre(atelier_id));
create policy commandes_modif on public.commandes for update to authenticated
  using (public.est_membre(atelier_id)) with check (public.est_membre(atelier_id));
create policy paiements_lecture on public.paiements for select to authenticated using (public.est_membre(atelier_id));
