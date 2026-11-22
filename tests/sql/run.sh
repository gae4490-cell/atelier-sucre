#!/usr/bin/env bash
# Lance les migrations et les tests SQL sur un Postgres 15+ jetable.
set -euo pipefail
cd "$(dirname "$0")/../.."
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
DIR=$(mktemp -d)
"$PGBIN/initdb" -D "$DIR" -U postgres >/dev/null
"$PGBIN/pg_ctl" -D "$DIR" -o "-k $DIR -p 54329 -c listen_addresses=''" -l "$DIR/log" start >/dev/null
trap '"$PGBIN/pg_ctl" -D "$DIR" stop -m immediate >/dev/null; rm -rf "$DIR"' EXIT
PSQL="psql -h $DIR -p 54329 -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL -f tests/sql/supabase-stub.sql 2>/dev/null
for f in supabase/migrations/*.sql; do echo "migration $f"; $PSQL -f "$f"; done
$PSQL -f tests/sql/rls-test.sql 2>&1 | grep -E 'RLS_OK|ECHEC' || true
$PSQL -f tests/sql/ventes-test.sql 2>&1 | grep -E 'VENTES_OK|ECHEC|ERROR' || true
bash tests/sql/concurrence.sh "$PSQL"
bash tests/sql/mise-a-jour.sh
