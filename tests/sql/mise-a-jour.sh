#!/usr/bin/env bash
# Applique la migration 3 sur une base contenant déjà des données de la livraison 1.
set -euo pipefail
cd "$(dirname "$0")/../.."
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
DIR=$(mktemp -d)
"$PGBIN/initdb" -D "$DIR" -U postgres >/dev/null 2>&1
"$PGBIN/pg_ctl" -D "$DIR" -o "-k $DIR -p 54330 -c listen_addresses=''" -l "$DIR/log" start >/dev/null
trap '"$PGBIN/pg_ctl" -D "$DIR" stop -m immediate >/dev/null; rm -rf "$DIR"' EXIT
PSQL="psql -h $DIR -p 54330 -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL -f tests/sql/supabase-stub.sql 2>/dev/null
$PSQL -f supabase/migrations/20261120000001_schema.sql
$PSQL -f supabase/migrations/20261120000002_storage.sql
$PSQL <<'SQL'
insert into auth.users values ('55555555-5555-5555-5555-555555555555', 'ancien@test.fr');
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select public.creer_atelier('Ancien atelier', 'ancien-atelier', 'ancien@test.fr');
update public.ateliers set publie = true;
reset role;
insert into public.demandes (atelier_id, prenom, email, telephone, date_souhaitee, nb_parts, mode, cle_idempotence)
select id, 'Client', 'c@test.fr', '33600000000', current_date + 5, 10, 'retrait', gen_random_uuid() from public.ateliers;
SQL
$PSQL -f supabase/migrations/20261121000003_ventes.sql
R=$($PSQL -At -c "select (select count(*) from public.demandes where source = 'inconnue')::text || '/' || (select count(*) from public.abonnements where offre = 'essentiel')::text || '/' || (select fuseau from public.ateliers limit 1)")
[ "$R" = "1/1/Europe/Paris" ] && echo MISE_A_JOUR_OK || { echo "ECHEC mise à jour : $R"; exit 1; }
