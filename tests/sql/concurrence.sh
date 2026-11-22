#!/usr/bin/env bash
# Deux clientes tentent d'acheter la dernière box au même instant.
set -euo pipefail
PSQL="$1"
$PSQL -At <<'SQL' > /tmp/as-ids
set role service_role;
with a as (select id from public.ateliers where slug = 'sarah-patisserie'),
     p as (insert into public.publications (atelier_id, type, titre, prix_cents, stock_total) select id, 'vente_flash', 'Ultime box', 1800, 1 from a returning id, atelier_id),
     c as (insert into public.creneaux (atelier_id, publication_id, debut, fin) select atelier_id, id, now() + interval '1 day', now() + interval '1 day 2 hours' from p returning id, publication_id)
select publication_id || ' ' || id from c;
SQL
read PUB CR < /tmp/as-ids
$PSQL -c "update public.abonnements set statut = 'simule', fin_acces = null where atelier_id = (select atelier_id from public.publications where id = '$PUB'); update public.publications set statut = 'publiee' where id = '$PUB';" >/dev/null
achat() {
  $PSQL -At -c "set role service_role; begin; select reservation_id from public.reserver_vente('$PUB', '$CR', 1, '$1', '$1@test.fr', '336', null, gen_random_uuid()); select pg_sleep(1); commit;" 2>&1 | grep -oE 'stock_insuffisant|^[0-9a-f-]{36}$' || true
}
achat cliente1 > /tmp/as-1 & achat cliente2 > /tmp/as-2 & wait
R1=$(cat /tmp/as-1); R2=$(cat /tmp/as-2)
echo "cliente 1 : $R1"; echo "cliente 2 : $R2"
N=$($PSQL -At -c "select count(*) from public.reservations where publication_id = '$PUB' and statut = 'en_attente'")
if [ "$N" = "1" ] && { [ "$R1" = "stock_insuffisant" ] || [ "$R2" = "stock_insuffisant" ]; }; then echo CONCURRENCE_OK; else echo "ECHEC concurrence ($N réservations)"; exit 1; fi
