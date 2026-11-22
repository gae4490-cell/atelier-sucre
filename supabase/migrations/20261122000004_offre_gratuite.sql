begin;

alter table public.abonnements
  drop constraint abonnements_offre_check;

alter table public.abonnements
  alter column offre set default 'gratuit',
  add constraint abonnements_offre_check
    check (offre in ('gratuit', 'essentiel', 'pro', 'atelier'));

create or replace function public.offre_active(p_atelier uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when a.offre in ('essentiel', 'pro', 'atelier')
        and a.statut in ('actif', 'essai', 'en_retard', 'simule')
        and (a.fin_acces is null or a.fin_acces > now())
      then a.offre
      else 'gratuit'
    end
    from public.abonnements a
    where a.atelier_id = p_atelier
  ), 'gratuit');
$$;
create function public.tg_publications_limite_gratuite()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.statut <> 'publiee' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.statut = 'publiee' and old.atelier_id = new.atelier_id then
      return new;
    end if;
  end if;

  if public.offre_active(new.atelier_id) <> 'gratuit' then
    return new;
  end if;

  -- Contrôle une publication à la fois pour cet atelier.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('publication-gratuite:' || new.atelier_id::text, 0)
  );

  if exists (
    select 1
    from public.publications p
    where p.atelier_id = new.atelier_id
      and p.statut = 'publiee'
      and p.id <> new.id
  ) then
    raise exception 'limite_publication_gratuite' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger publications_limite_gratuite
  before insert or update on public.publications
  for each row execute function public.tg_publications_limite_gratuite();
commit;