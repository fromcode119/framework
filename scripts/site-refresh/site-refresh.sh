#!/usr/bin/env bash
#
# Refresh a platform site from a live single-tenant deployment.
#
# DIRECTION IS STRICTLY prod -> staging, NEVER back. Nothing here writes to the source; the only
# statement it issues there is `pg_dump`, and the uploads are read with `tar -c`. Anything done on
# the staging copy is destroyed by the next refresh, which is what makes divergence structurally
# impossible: the copy is never edited, only replaced.
#
#   ./site-refresh.sh --site <name> pull      # 1. snapshot the source, stream it to the target
#   ./site-refresh.sh --site <name> build     # 2. restore into a SCRATCH db, write the archive
#   ./site-refresh.sh --site <name> fetch     # 2b. download the archive for the admin upload
#   ./site-refresh.sh --site <name> swap      # 3. DESTRUCTIVE: replace the staging tenant
#   ./site-refresh.sh --site <name> secrets   # 3b. integration credentials (Econt, SMTP, ...), source -> tenant
#   ./site-refresh.sh --site <name> mark      # 4. private + non-production
#   ./site-refresh.sh --site <name> check     # 5. verification checklist
#   ./site-refresh.sh --site <name> dry       # stages 1-2 only, then stop and report
#
# `swap` is deliberately NOT part of `dry` and never runs implicitly. It deletes the existing
# staging tenant — `deleteTenant` exports-then-erases, so the previous copy is archived rather than
# lost, but it is still the one irreversible step and it asks before acting.
#
# `secrets` is not part of `dry` either, and for the same underlying reason `swap` isn't: `dry`
# documents that it touches nothing on the platform, and there is no tenant for a credential to be
# written into until `swap execute` has actually run. `swap execute` therefore runs `secrets` itself,
# right after `check`, in the same place it already runs `mark` and `check` — the one spot in this
# file where the imported tenant is known to exist. Run `secrets` by hand only to retry it alone
# (e.g. after fixing SSH access) without repeating the whole import.
#
set -euo pipefail

# ---------------------------------------------------------------------------------------------------
# WHICH SITE is not written here. This file is the procedure; a site is a config passed to it.
#
#   ./site-refresh.sh --site <name> <stage>
#
# The config lives OUTSIDE this repository, beside the deploy targets that are gitignored for the same
# reason: it names hosts, container ids and database users of somebody's production box. Default
# search path is ../../../../scripts/site-refresh.d/<name>.conf — the platform root, not the package.
# See site-refresh.conf.example for every variable and what it means.
#
# The script named one site and carried its hostnames inline, which is why it lived outside version
# control on a single disk: it could not be shared without sharing them.
# ---------------------------------------------------------------------------------------------------
SITE_CONFIG=""
SITE_NAME=""
while [ $# -gt 0 ]; do
  case "$1" in
    --site)   SITE_NAME="$2"; shift 2 ;;
    --config) SITE_CONFIG="$2"; shift 2 ;;
    *) break ;;
  esac
done

HERE="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_ROOT="$(cd "$HERE/../../../.." && pwd)"
[ -n "$SITE_CONFIG" ] || SITE_CONFIG="$PLATFORM_ROOT/scripts/site-refresh.d/${SITE_NAME}.conf"

if [ -z "$SITE_NAME" ] && [ -z "$SITE_CONFIG" ]; then
  echo "usage: $0 --site <name> <stage>    (or --config <path> <stage>)" >&2
  exit 2
fi
if [ ! -f "$SITE_CONFIG" ]; then
  echo "no config for this site at $SITE_CONFIG" >&2
  echo "copy $HERE/site-refresh.conf.example and fill it in; it stays outside git on purpose." >&2
  exit 2
fi
# shellcheck disable=SC1090
. "$SITE_CONFIG"

for required in SOURCE_HOST TARGET_HOST SOURCE_DB_CONTAINER SOURCE_DB_USER SOURCE_DB_NAME \
                TARGET_DEPLOY_DIR WORK_DIR SCRATCH_DB SITE_SLUG SITE_KEY SITE_HOST; do
  eval "value=\${$required:-}"
  [ -n "$value" ] || { echo "$SITE_CONFIG does not set $required" >&2; exit 2; }
done
SITE_ALIAS="${SITE_ALIAS:-}"
SOURCE_API_CONTAINER="${SOURCE_API_CONTAINER:-}"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

target() { ssh -o ConnectTimeout=20 "$TARGET_HOST" "$@"; }
source_box() { ssh -o ConnectTimeout=20 "$SOURCE_HOST" "$@"; }
# Everything on the target that needs the platform's own postgres goes through its compose project.
target_db() { target "cd $TARGET_DEPLOY_DIR && docker compose exec -T db $*"; }
target_api() { target "cd $TARGET_DEPLOY_DIR && docker compose exec -T api $*"; }

stage_pull() {
  say "1/5 pull — snapshot $SOURCE_DB_NAME and its uploads, streamed to $TARGET_HOST"
  target "mkdir -p $WORK_DIR/uploads"

  # -Fc so `pg_restore` can rebuild it; the stream never touches the source's disk.
  local started; started=$(date +%s)
  source_box "docker exec $SOURCE_DB_CONTAINER pg_dump -Fc -U $SOURCE_DB_USER $SOURCE_DB_NAME" \
    | target "cat > $WORK_DIR/dump.pgc"
  echo "   dump: $(target "du -h $WORK_DIR/dump.pgc | cut -f1")  ($(($(date +%s) - started))s)"

  # tar rather than rsync: the two boxes cannot reach each other, so everything is piped through
  # this machine, and tar is the form that survives that without a second SSH hop.
  started=$(date +%s)
  source_box "docker exec $SOURCE_API_CONTAINER tar -C /app/public/uploads -cf - ." \
    | target "tar -C $WORK_DIR/uploads -xf -"
  echo "   uploads: $(target "find $WORK_DIR/uploads -type f | wc -l") file(s)  ($(($(date +%s) - started))s)"
}

stage_build() {
  say "2/5 build — restore into $SCRATCH_DB (never the platform db) and write the archive"

  # The scratch database is dropped and recreated every run, so a half-finished previous restore can
  # never be read as this run's data.
  target_db "psql -U fromcode -d postgres -c \"DROP DATABASE IF EXISTS $SCRATCH_DB WITH (FORCE)\"" >/dev/null
  # Owned by the role the api already has credentials for, so the exporter can read it without a
  # second secret being introduced anywhere.
  target_db "psql -U fromcode -d postgres -c \"CREATE DATABASE $SCRATCH_DB OWNER fromcode_owner\"" >/dev/null
  # Owning the DATABASE is not owning its `public` SCHEMA — that comes from the template and stays
  # with the superuser, so the restore failed with "permission denied for schema public" and left 0
  # of 133 tables while reporting only a warning count.
  target_db "psql -U fromcode -d $SCRATCH_DB -c \"ALTER SCHEMA public OWNER TO fromcode_owner\"" >/dev/null

  target "cd $TARGET_DEPLOY_DIR && docker compose cp $WORK_DIR/dump.pgc db:/tmp/dump.pgc"
  # Restored AS `fromcode_owner`, not as the superuser. With `--no-owner` every object lands owned by
  # the RESTORING role, so restoring as `fromcode` left the tables owned by a role the api has no
  # credentials for and the exporter died on "permission denied for table users". The api reads this
  # database with the migration role, so that role has to own what it reads.
  # --no-acl too: the source's grants reference roles that do not exist here.
  target_db "pg_restore -U fromcode_owner -d $SCRATCH_DB --no-owner --no-acl /tmp/dump.pgc" 2>&1 | tail -3 || true
  echo "   restored: $(target_db "psql -U fromcode -d $SCRATCH_DB -tAc \"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'\"" | tr -d '[:space:]') table(s)"

  # The archive is built INSIDE the api container: it is the only place the exporter and its
  # dependencies exist, and it can reach both databases over the compose network.
  target "cd $TARGET_DEPLOY_DIR && docker compose cp $WORK_DIR/uploads api:/tmp/${SITE_KEY}-uploads"
  # The scratch URL is derived from the api's OWN migration URL inside the container, so the
  # password is never interpolated by this script and never reaches a shell history.
  target_api "sh -c 'node /app/packages/api/dist/cli/tenant-export.js \
      --database \"\${DATABASE_MIGRATION_URL%/*}/$SCRATCH_DB\" \
      --uploads /tmp/${SITE_KEY}-uploads \
      --slug $SITE_SLUG --host $SITE_HOST ${SITE_ALIAS:+--alias $SITE_ALIAS} \
      --out /tmp/${SITE_KEY}-archive.tar.gz'" 2>&1 | tail -8
  echo "   archive: $(target_api "sh -c 'du -h /tmp/${SITE_KEY}-archive.tar.gz | cut -f1'" | tr -d '[:space:]')"
}

stage_report() {
  say "archive contents — what WOULD be imported"
  target_api "sh -c 'tar -tzf /tmp/${SITE_KEY}-archive.tar.gz | head -40'" 2>&1 | tail -42
  echo
  echo "   total entries: $(target_api "sh -c 'tar -tzf /tmp/${SITE_KEY}-archive.tar.gz | wc -l'" | tr -d '[:space:]')"
}

stage_fetch() {
  say "2b/5 fetch — bring the archive here, for the admin's import upload"
  # Preview and execute resolve an `uploadId` from an upload SESSION, not a server path
  # (`tenant-admin-controller.ts:142,154`), so the archive cannot be imported in place: it has to
  # arrive through the admin's chunked upload like any other. Downloading it is the whole of stage 3's
  # preparation, and the preview screen is where the import is inspected before anything is written.
  local out="$PWD/${SITE_KEY}-archive.tar.gz"
  target "cd $TARGET_DEPLOY_DIR && docker compose cp api:/tmp/${SITE_KEY}-archive.tar.gz /tmp/${SITE_KEY}-archive.tar.gz" >/dev/null
  scp -q -o ConnectTimeout=20 "$TARGET_HOST:/tmp/${SITE_KEY}-archive.tar.gz" "$out"
  echo "   $out  ($(du -h "$out" | cut -f1))"
}

# The imported tenant's id on the platform, resolved from the slug rather than assumed. Empty output
# means the tenant does not exist yet, which every stage below reports rather than treating as zero.
tenant_id() {
  target_db "psql -U fromcode -d fromcode -tAc \"SELECT id FROM _system_tenants WHERE slug = '$SITE_SLUG'\"" \
    | tr -d '[:space:]'
}

# Counts every table in the SCRATCH database (the restored production dump) beside the same table in
# the platform, narrowed to this tenant. Both sides are read as the superuser, which BYPASSES row
# level security — deliberate here and nowhere else: a count that RLS narrowed would silently agree
# with itself. The tenant filter is written explicitly instead.
# Row counts prove nothing arrived MISSING. They cannot prove what arrived is still CORRECT: 28 tables
# were re-numbered on import, and a remap that re-pointed a reference wrongly moves no row count at
# all. This is the half of §8 that a machine can do.
#
# What it deliberately does NOT check: foreign keys. Postgres ENFORCES them here, so a declared
# relationship cannot be orphaned — the insert would have failed and the import would have stopped.
# Checking them would only prove the database works. The referential risk that survives is the one the
# import plan names: ids embedded in JSON that the remap does not follow, because nothing declares
# them as references. Those are reported so a human can look at them.
stage_verify() {
  say "verify — money, natural keys and the invoice series, source vs imported"
  local tid; tid=$(tenant_id)
  if [ -z "$tid" ]; then
    echo "   Tenant '$SITE_SLUG' does not exist on the platform yet. Nothing to verify." >&2
    exit 2
  fi

  # Every numeric column of every tenant table, summed on both sides. Schema-driven rather than a
  # hand-listed set of "the money tables": a hand-list goes stale the moment a plugin adds a column,
  # and the column it forgets is the one nobody notices is wrong.
  local sums_src sums_dst
  sums_src=$(target_db "psql -U fromcode -d $SCRATCH_DB -tAc \"
    SELECT string_agg(format('%s.%s=%s', t, c, v), E'\n')
    FROM (
      SELECT c.table_name AS t, c.column_name AS c2, c.column_name AS c,
             (xpath('/row/s/text()', query_to_xml(format('SELECT coalesce(sum(%I),0) AS s FROM %I', c.column_name, c.table_name), false, true, '')))[1]::text AS v
      FROM information_schema.columns c
      JOIN information_schema.tables tb ON tb.table_name = c.table_name AND tb.table_schema = 'public' AND tb.table_type = 'BASE TABLE'
      WHERE c.table_schema='public' AND c.data_type IN ('numeric','double precision','real')
    ) s\"" 2>/dev/null)

  sums_dst=$(target_db "psql -U fromcode -d fromcode -tAc \"
    SELECT string_agg(format('%s.%s=%s', t, c, v), E'\n')
    FROM (
      SELECT c.table_name AS t, c.column_name AS c,
             (xpath('/row/s/text()', query_to_xml(format('SELECT coalesce(sum(%I),0) AS s FROM %I WHERE tenant_id = %L', c.column_name, c.table_name, '$tid'), false, true, '')))[1]::text AS v
      FROM information_schema.columns c
      JOIN information_schema.tables tb ON tb.table_name = c.table_name AND tb.table_schema = 'public' AND tb.table_type = 'BASE TABLE'
      JOIN information_schema.columns tc ON tc.table_name = c.table_name AND tc.table_schema='public' AND tc.column_name = 'tenant_id'
      WHERE c.table_schema='public' AND c.data_type IN ('numeric','double precision','real')
    ) s\"" 2>/dev/null)

  # Natural keys: these are STRINGS, so the remap never touches them. If an order_number present in the
  # source is missing here, a row did not arrive — and unlike a row count this says WHICH.
  local nat_src nat_dst
  nat_src=$(target_db "psql -U fromcode -d $SCRATCH_DB -tAc \"
    SELECT string_agg(k, E'\n') FROM (
      SELECT 'order:'||order_number AS k FROM fcp_ecommerce_orders WHERE order_number IS NOT NULL
      UNION ALL SELECT 'invoice:'||invoice_number FROM fcp_finance_invoices WHERE invoice_number IS NOT NULL
    ) s\"" 2>/dev/null)
  nat_dst=$(target_db "psql -U fromcode -d fromcode -tAc \"
    SELECT string_agg(k, E'\n') FROM (
      SELECT 'order:'||order_number AS k FROM fcp_ecommerce_orders WHERE tenant_id='$tid' AND order_number IS NOT NULL
      UNION ALL SELECT 'invoice:'||invoice_number FROM fcp_finance_invoices WHERE tenant_id='$tid' AND invoice_number IS NOT NULL
    ) s\"" 2>/dev/null)

  # The invoice series, and whether its next value would collide with a number ANOTHER site already
  # holds. A collision is not a row-count problem and would surface as a duplicate invoice number on
  # the first sale after cutover.
  # Split by FORMAT before saying anything about the series. This site has two: a numeric run and a
  # handful of `INV-...` strings. A min/max across both is a LEXICAL range — it put `1000000007` next
  # to `INV-MTOAU4T0-...` and looked like a series report while proving nothing. Contiguity is only
  # meaningful for the numeric run, so only that is claimed.
  local series
  series=$(target_db "psql -U fromcode -d fromcode -tAc \"
    SELECT n||'|'||lo||'|'||hi||'|'||span||'|'||other||'|'||collisions FROM (
      SELECT count(*) FILTER (WHERE invoice_number ~ '^[0-9]+\$') AS n,
             coalesce(min(invoice_number::bigint) FILTER (WHERE invoice_number ~ '^[0-9]+\$'), 0) AS lo,
             coalesce(max(invoice_number::bigint) FILTER (WHERE invoice_number ~ '^[0-9]+\$'), 0) AS hi,
             coalesce(max(invoice_number::bigint) FILTER (WHERE invoice_number ~ '^[0-9]+\$'), 0)
               - coalesce(min(invoice_number::bigint) FILTER (WHERE invoice_number ~ '^[0-9]+\$'), 0) + 1 AS span,
             count(*) FILTER (WHERE invoice_number !~ '^[0-9]+\$') AS other,
             (SELECT count(*) FROM fcp_finance_invoices o WHERE o.tenant_id <> '$tid'
                AND o.invoice_number IN (SELECT invoice_number FROM fcp_finance_invoices WHERE tenant_id='$tid')) AS collisions
      FROM fcp_finance_invoices WHERE tenant_id='$tid') s\"" 2>/dev/null | tr -d '[:space:]')

  SUMS_SRC="$sums_src" SUMS_DST="$sums_dst" NAT_SRC="$nat_src" NAT_DST="$nat_dst" SERIES="$series" python3 - <<'PY'
import os, sys
from decimal import Decimal, InvalidOperation

def parse(blob):
    out = {}
    for line in (blob or '').splitlines():
        line = line.strip()
        if '=' in line:
            name, _, value = line.rpartition('=')
            try:
                out[name] = Decimal(value or '0')
            except InvalidOperation:
                pass
    return out

src, dst = parse(os.environ['SUMS_SRC']), parse(os.environ['SUMS_DST'])
failed = False

# Only columns the destination actually holds for this tenant. A column the platform does not have is
# already reported by `check` as a dropped column or an absent table; repeating it here as a money
# discrepancy would be the same fact wearing a more alarming hat.
shared = [k for k in sorted(src) if k in dst]
drift = [(k, src[k], dst[k]) for k in shared if src[k] != dst[k]]
print(f'   numeric columns compared: {len(shared)}')
if drift:
    failed = True
    print(f'\n   VALUE DRIFT ({len(drift)}) — a sum that moved is data that changed in transit:')
    for name, a, b in drift:
        print(f'     {name:<52} source {a:>16}   imported {b:>16}')
else:
    print('   Every numeric column sums identically on both sides.')

nat_src = {k.strip() for k in (os.environ.get('NAT_SRC') or '').splitlines() if k.strip()}
nat_dst = {k.strip() for k in (os.environ.get('NAT_DST') or '').splitlines() if k.strip()}
missing, extra = sorted(nat_src - nat_dst), sorted(nat_dst - nat_src)
print(f'\n   natural keys compared: {len(nat_src)} (order and invoice numbers — strings, never re-numbered)')
if missing or extra:
    failed = True
    if missing:
        print(f'     MISSING here ({len(missing)}): {", ".join(missing[:12])}')
    if extra:
        print(f'     PRESENT here but not in the source ({len(extra)}): {", ".join(extra[:12])}')
else:
    print('   Every order and invoice number in the source is present here, and nothing extra.')

parts = (os.environ.get('SERIES') or '').split('|')
if len(parts) == 6:
    n, lo, hi, span, other, collisions = (int(x or 0) for x in parts)
    print(f'\n   invoice series: {n} numbered {lo}..{hi}' + (f', plus {other} in another format' if other else ''))
    if n and n != span:
        # NOT a failure. A gap can be a cancelled or deleted invoice and is the source's own history —
        # the migration's job is to carry it faithfully, not to tidy it. Reported because an operator
        # asked about the series would want to know, and silence here would read as "contiguous".
        print(f'     {span - n} gap(s) in the run — present in the SOURCE too; carried as-is, not invented here.')
    elif n:
        print('   The numbered run is contiguous: no gaps.')
    if collisions:
        failed = True
        print(f'     COLLISION: {collisions} of these numbers are already held by ANOTHER site.')
        print('     The first sale after cutover would issue a duplicate invoice number.')
    else:
        print('   No invoice number here is held by another site.')

print()
if failed:
    print('   NOT VERIFIED — the differences above block the cutover.')
    sys.exit(1)
print('   VERIFIED: values, natural keys and the invoice series all agree with the source.')
PY
}

stage_check() {
  say "5/5 check — source rows vs imported rows, per table"
  local tid; tid=$(tenant_id)
  if [ -z "$tid" ]; then
    echo "   Tenant '$SITE_SLUG' does not exist on the platform yet. Nothing to check." >&2
    echo "   Run the import first (see '$0 swap')." >&2
    exit 2
  fi
  echo "   tenant: $SITE_SLUG ($tid)"

  # Built as ONE query per side rather than a round trip per table: 133 SSH round trips is minutes,
  # and a check nobody waits for is a check nobody runs.
  local src dst
  src=$(target_db "psql -U fromcode -d $SCRATCH_DB -tAc \"
    SELECT string_agg(format('%s=%s', t, n), E'\n')
    FROM (SELECT c.relname AS t,
                 (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I', c.relname), false, true, '')))[1]::text::int AS n
          FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
          WHERE ns.nspname = 'public' AND c.relkind = 'r') s\"" 2>/dev/null)

  dst=$(target_db "psql -U fromcode -d fromcode -tAc \"
    SELECT string_agg(format('%s=%s', t, n), E'\n')
    FROM (SELECT c.relname AS t,
                 (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I WHERE tenant_id = %L', c.relname, '$tid'), false, true, '')))[1]::text::int AS n
          FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
          WHERE ns.nspname = 'public' AND c.relkind = 'r') s\"" 2>/dev/null)

  # Every table the platform HAS, tenant-scoped or not. Without this a platform-level table like
  # `users` or `_system_migrations` — which exists but carries no tenant_id — is indistinguishable
  # from a table the platform genuinely lacks, and the check reports "no such table" about a table
  # sitting right there. Two different facts, two different answers for the operator.
  local present
  present=$(target_db "psql -U fromcode -d fromcode -tAc \"
    SELECT string_agg(c.relname, E'\n')
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r'\"" 2>/dev/null)

  # `_system_meta` is compared by KEY, not by count. A count can only say "four short", which is the
  # same answer whether the four are the platform's own URLs (correct to leave behind) or four of this
  # site's settings that failed to arrive (a blocker). Those need opposite responses, so the check has
  # to know which keys they are rather than how many.
  local meta_src meta_dst
  meta_src=$(target_db "psql -U fromcode -d $SCRATCH_DB -tAc \"SELECT string_agg(key, E'\n') FROM _system_meta\"" 2>/dev/null)
  meta_dst=$(target_db "psql -U fromcode -d fromcode -tAc \"SELECT string_agg(key, E'\n') FROM _system_meta WHERE tenant_id = '$tid'\"" 2>/dev/null)

  # Compared here rather than in SQL so the two sides stay independently readable, and so a table
  # present on one side only is reported as such instead of vanishing from a join.
  SRC="$src" DST="$dst" PRESENT="$present" META_SRC="$meta_src" META_DST="$meta_dst" python3 - <<'PY'
import os, sys

def parse(blob):
    out = {}
    for line in (blob or '').splitlines():
        line = line.strip()
        if '=' in line:
            name, _, count = line.rpartition('=')
            if name and count.isdigit():
                out[name] = int(count)
    return out

src = parse(os.environ['SRC'])
dst = parse(os.environ['DST'])
present = {line.strip() for line in (os.environ.get('PRESENT') or '').splitlines() if line.strip()}
if not src:
    print('   Could not read the scratch database. Run `build` first.'); sys.exit(2)

# Tables the IMPORTER refuses to carry, so a difference in them is the design working rather than
# data going missing. Source of truth is `TenantTableCatalog.EXCLUDED`
# (packages/core/src/tenant/provisioning/tenant-table-catalog.ts) — if that set changes, this list has
# to follow, and a table listed here that the importer no longer excludes would show as a silent pass.
# Named rather than skipped: the operator still sees the row and what it means.
BY_DESIGN = {
    '_system_sessions': 'a session belongs to a login, not to a site',
    '_system_tenants': 'the tenant record is created by the import, not carried',
    '_system_tenant_plugins': "the destination decides which plugins this site runs",
    '_system_tenant_themes': 'the destination decides which theme this site runs',
    '_system_tenant_memberships': 'membership is granted here, not inherited',
}

SETTINGS_TABLE = '_system_meta'

# Declared `SettingScope.PLATFORM` in `SystemSettingRegistry` — source of truth is
# packages/core/src/settings/system-setting-registry.ts. Scope is decided by WHO READS a setting, and
# nothing site-scoped reads these: `maintenance_mode` gates the whole deployment, and the three URLs
# are how one app of the deployment reaches another. A SITE archive therefore cannot carry them, and
# their absence is the scope rule working.
#
# Verified on this platform 2026-09-15: all four exist ONLY as `tenant_id IS NULL` rows, with no
# per-site row for any site — so there is no pre-registry row quietly failing to travel. Re-check that
# before trusting this on another deployment; a legacy per-site `site_url` WOULD be real data lost.
PLATFORM_SCOPED = {'site_url', 'frontend_url', 'admin_url', 'maintenance_mode'}

meta_src = {k.strip() for k in (os.environ.get('META_SRC') or '').splitlines() if k.strip()}
meta_dst = {k.strip() for k in (os.environ.get('META_DST') or '').splitlines() if k.strip()}
meta_unexplained: list[str] = []

mismatched, absent, untenanted, by_design = [], [], [], []
for table in sorted(src):
    have = src[table]
    if table in BY_DESIGN:
        if dst.get(table, 0) != have:
            by_design.append((table, have, dst.get(table, 0), BY_DESIGN[table]))
        continue
    if table in dst:
        # The import writes its OWN audit entry, so the journal legitimately ends up one row AHEAD of
        # the source. Only a SURPLUS is forgiven, and only here: a journal short of rows is still a
        # mismatch, because that would be history that did not survive.
        if table == '_system_audit_logs' and dst[table] >= have:
            by_design.append((table, have, dst[table], 'the import records itself, so this runs ahead'))
            continue
        if table == SETTINGS_TABLE and meta_src:
            missing = sorted(meta_src - meta_dst)
            unexplained = [key for key in missing if key not in PLATFORM_SCOPED]
            if not unexplained:
                by_design.append((table, have, dst[table],
                                  f'{len(missing)} platform-scoped key(s) stay with the platform'))
            else:
                meta_unexplained = unexplained
                mismatched.append((table, have, dst[table]))
            continue
        if dst[table] != have:
            mismatched.append((table, have, dst[table]))
    elif table in present:
        # Exists here, but holds no tenant_id — a PLATFORM-level table. Its rows are not this site's
        # to carry, so a difference is not a fault and must not be counted as one.
        if have:
            untenanted.append((table, have))
    else:
        # Genuinely no destination: the plugin that owns it is not installed or not enabled here.
        if have:
            absent.append((table, have))

compared = [t for t in src if t in dst]
print(f'   tables compared: {len(compared)}   source rows: {sum(src[t] for t in compared)}'
      f'   imported: {sum(dst[t] for t in compared)}')

if by_design:
    print(f'\n   NOT CARRIED BY DESIGN ({len(by_design)}) — not a fault:')
    for table, have, got, why in sorted(by_design, key=lambda r: -r[1]):
        print(f'     {table:<34} source {have:>8}   imported {got:>8}   {why}')

if untenanted:
    print(f'\n   PLATFORM-LEVEL here, not this site’s rows ({len(untenanted)}) — not a fault:')
    for table, have in sorted(untenanted, key=lambda r: -r[1]):
        print(f'     {table:<48} source {have:>8}')

if absent:
    print(f'\n   NO DESTINATION — the owning plugin is not installed or enabled ({len(absent)}):')
    for table, have in sorted(absent, key=lambda r: -r[1]):
        print(f'     {table:<48} source {have:>8}')

if mismatched:
    lost = sum(h - g for _, h, g in mismatched if h > g)
    print(f'\n   MISMATCH ({len(mismatched)}) — these block the cutover. {lost} row(s) short in total:')
    for table, have, got in sorted(mismatched, key=lambda r: -abs(r[1] - r[2])):
        print(f'     {table:<48} source {have:>8}   imported {got:>8}   delta {got - have:+}')
    # Named, not counted. These are the keys that did NOT arrive and are not platform-scoped, which is
    # the case this table is worth checking for at all.
    if meta_unexplained:
        print(f'\n   Settings keys that did not arrive and are NOT platform-scoped ({len(meta_unexplained)}):')
        for key in meta_unexplained:
            print(f'     {key}')
    sys.exit(1)

print('\n   Every tenant-scoped table matches the source, row for row.')
PY
}

# Per §6 the switch is set AT CREATION by the import, never bolted on afterwards — there must never be
# a moment when a copy of a live shop exists with live credentials and no brake. So this stage does not
# SET anything; it proves the import already did, and fails loudly if it did not.
stage_mark() {
  say "4/5 mark — prove the brake was on from the moment the tenant existed"
  local tid; tid=$(tenant_id)
  if [ -z "$tid" ]; then
    echo "   Tenant '$SITE_SLUG' does not exist on the platform yet." >&2
    exit 2
  fi
  local row
  row=$(target_db "psql -U fromcode -d fromcode -tAc \"
    SELECT coalesce(environment,'?') || '|' || coalesce(visibility,'?') || '|' || coalesce(primary_host,'?')
    FROM _system_tenants WHERE id = '$tid'\"" | tr -d '[:space:]')
  local env="${row%%|*}"; local rest="${row#*|}"
  local vis="${rest%%|*}"; local host="${rest##*|}"
  echo "   environment: $env"
  echo "   visibility:  $vis"
  echo "   primary host: $host"

  local bad=0
  [ "$env" = "non-production" ] || { echo "   FAIL: environment is '$env', expected 'non-production'." >&2; bad=1; }
  [ "$vis" = "private" ]        || { echo "   FAIL: visibility is '$vis', expected 'private'." >&2; bad=1; }
  # Claiming the live host while the real site still serves it from the old box would take that site
  # down the moment DNS moved: a private tenant serves the platform's gate page, not the shop. The
  # live host is introduced deliberately at cutover, never by a refresh.
  case "$host" in
    *.fromcode.com) ;;
    *) echo "   FAIL: primary host is '$host'. A refresh must never claim the live host (§9 step 4)." >&2; bad=1 ;;
  esac
  [ "$bad" = 0 ] && echo "   Brake is on, set at creation." || exit 1
}

# Import half only. The DELETE half is deliberately not here.
#
# `tenant-import` (framework #25) closed the half that was missing: preview and execute already took
# an archive PATH — only the HTTP controller insisted on resolving an `uploadId` from a browser upload
# session. So the import can now run on the box, against the archive `build` just wrote.
#
# Deleting the existing staging tenant is still done by a human in the admin, and that is a decision,
# not an omission. `deleteTenant` exports-then-erases, so the previous copy is archived rather than
# lost — but it is the one step in this loop that cannot be taken back by re-running anything, and a
# script that does it on the way past is a script that eventually does it to the wrong tenant. This
# stage therefore REFUSES while the tenant exists and names what to do, instead of clearing the way
# itself.
stage_swap() {
  local mode="${2:-preview}"
  say "3/5 swap — import the archive (mode: $mode)"

  local tid; tid=$(tenant_id)
  if [ -n "$tid" ] && [ "$mode" = "execute" ]; then
    cat >&2 <<EOF
   REFUSING: tenant '$SITE_SLUG' already exists ($tid).

   A refresh REPLACES the staging copy, so the existing one has to go first — and deleting it is the
   one irreversible step in this loop. It is not automated here on purpose.

   Delete it in the admin (Sites -> $SITE_SLUG -> Delete). That exports-then-erases, so the copy you
   are replacing is archived rather than lost. Then run this again.
EOF
    exit 2
  fi

  # The CLI ships INSIDE the api image, so merging it to main does not put it on the box — the running
  # container is whatever version was last deployed. Checked up front because the failure otherwise is
  # a bare "Cannot find module", which reads like a broken script rather than an undeployed one.
  if ! target_api "sh -c 'test -f /app/packages/api/dist/cli/tenant-import.js'" 2>/dev/null; then
    # `|| true` is load-bearing: `set -e` kills a standalone assignment whose substitution fails, and
    # this one is only decoration. Without it the script died HERE, before printing the explanation
    # below — the operator got exit 1 and an empty screen, which is the worst of both.
    local running
    running=$(target_api "sh -c 'cat /app/package.json'" 2>/dev/null | sed -n 's/.*\"version\": *\"\([^\"]*\)\".*/\1/p' | head -1 || true)
    cat >&2 <<EOF
   The tenant-import CLI is not in the image this box is running${running:+ (v$running)}.

   It landed on main in framework #25 but the api serves a RELEASED image, so it arrives only with a
   release and a deploy — and this box also serves the Hub and finestra-vip, so that is a platform
   deploy, not a private one.

   Until then the import is done in the browser:
     $0 fetch                                  # bring the archive here
     Sites -> Import a site -> drop it -> Preview -> read section 3 -> Import
     $0 mark && $0 check                       # prove the brake and the row counts
EOF
    exit 2
  fi

  # Preview is the CLI's default and the plan is the whole point of the stage: it is the last thing
  # anyone reads before a write. `--execute` is the only flag that writes; a plan with blockers exits
  # non-zero, so this stops rather than importing over a problem.
  local flags="--archive /tmp/${SITE_KEY}-archive.tar.gz --slug $SITE_SLUG --host $SITE_HOST"
  [ -n "$SITE_ALIAS" ] && flags="$flags --alias $SITE_ALIAS"
  # NOT passing --environment: the CLI defaults to non-production, and that default is the brake.
  # Naming it here would be one more place for a rehearsal to be imported as the real thing.
  [ "$mode" = "execute" ] && flags="$flags --execute"

  target_api "sh -c 'node /app/packages/api/dist/cli/tenant-import.js $flags'" 2>&1 | tail -40
  local rc=${PIPESTATUS[0]}

  if [ "$mode" != "execute" ]; then
    echo
    echo "   Nothing was written. Review the plan above, then:"
    echo "     $0 swap execute"
    return 0
  fi

  [ "$rc" = 0 ] || { echo "   Import FAILED (exit $rc). Nothing further will run." >&2; exit "$rc"; }
  say "imported — now proving the brake and the row counts"
  stage_mark
  stage_check
  # Only now does the tenant this stage writes into actually exist — `dry` deliberately stops before
  # this point (see the header comment), so this is the one place in the composite flow where a
  # credential transfer belongs. Run `secrets` by hand to retry it alone without repeating the import.
  stage_secrets secrets
}

# The transfer script is CODE, not data — it declares no secret of its own, so writing it to /tmp in
# each container is not the thing `secrets` exists to keep off disk. It is rewritten every run so a
# local edit here is never executed stale, and it is the same file in both containers: "export" runs
# on the source (decrypt), "import" runs on the target (re-encrypt) — one place for this logic to be
# wrong instead of two.
_secret_transfer_js() {
  cat <<'NODEJS'
'use strict';
const mode = process.argv[2];

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

// The only framework dependency this script has: the deployment's OWN encrypt/decrypt, called on
// its OWN box, so a value is only ever handled by the key that made it. Never reimplemented here.
// Precedent for requiring a core class from a plain (non-Next) node process outside the framework's
// own HTTP server: packages/api/src/cli/tenant-export-cli.ts imports several core classes straight
// from the '@fromcode119/core' barrel the same way. UNVERIFIED against a live container — if
// SecretService is not on that barrel, this require throws immediately and the stage fails loudly
// rather than silently skipping encryption (see the refresh script's own report on this).
const { SecretService } = require('@fromcode119/core');

// Every string leaf, whatever the shape — `profiles[].config.*`, `providers[].config.*`, or
// whatever a future integration type nests its settings under. A hand-written path list for "the
// profile shape" would miss `_..._providers`, or a shape a plugin adds later; walking everything is
// what makes this generic across every integration type without naming one anywhere.
function walk(node, onLeaf, path) {
  if (Array.isArray(node)) return node.map((item, i) => walk(item, onLeaf, `${path}[${i}]`));
  if (node && typeof node === 'object') {
    const out = {};
    for (const k of Object.keys(node)) out[k] = walk(node[k], onLeaf, `${path}.${k}`);
    return out;
  }
  if (typeof node === 'string') return onLeaf(node, path);
  return node;
}

// One label per object that carries a `config` — i.e. one per provider instance, wherever it is
// nested. Every name in the label comes from the DATA (providerKey/name/id, and the config's own
// key names) — never a hand-listed courier or plugin, so a new integration type needs no change here.
function collectLabels(type, node, labels) {
  if (Array.isArray(node)) { node.forEach((item) => collectLabels(type, item, labels)); return; }
  if (!node || typeof node !== 'object') return;
  if (node.config && typeof node.config === 'object') {
    const who = node.providerKey || node.name || node.id || '(unnamed)';
    const fields = Object.keys(node.config)
      .map((k) => `${k} ${node.config[k] !== '' && node.config[k] != null ? 'present' : 'absent'}`)
      .join(', ');
    labels.push(`${type} / ${who}: ${fields}`);
  }
  for (const k of Object.keys(node)) collectLabels(type, node[k], labels);
}

// mode=export (source): one JSON row per stdin line ({key, group, value}), `value` still the raw
// _system_meta text — possibly-encrypted. Decrypts every leaf that IS encrypted and records which
// leaves those were, by path. Which leaf is secret is decided by the data itself
// (SecretService.isEncryptedValue), never a hand-maintained field-name list.
async function runExport() {
  const raw = await readStdin();
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const row = JSON.parse(line);
    let parsed;
    try { parsed = JSON.parse(row.value); } catch { parsed = row.value; }
    const encryptedPaths = [];
    const decrypted = walk(parsed, (value, path) => {
      if (SecretService.isEncryptedValue(value)) { encryptedPaths.push(path); return SecretService.decrypt(value); }
      return value;
    }, '');
    out.push({ key: row.key, group: row.group, encryptedPaths, value: decrypted });
  }
  process.stdout.write(out.map((o) => JSON.stringify(o)).join('\n') + (out.length ? '\n' : ''));
}

// mode=import (target): re-encrypts exactly the leaves the export side flagged (same paths, same
// walk order, same shape — nothing else re-derives "which fields are secret"), and prints ONLY a
// field-presence report, never a value. Does not touch the database itself: the one thing that has
// to run "inside the app" here is the crypto; the write is plain psql, like everything else in this
// file, done by the caller after this prints its result.
async function runImport() {
  const raw = await readStdin();
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const row = JSON.parse(line);
    const encryptedPaths = new Set(row.encryptedPaths || []);
    const reencrypted = walk(row.value, (value, path) => (
      encryptedPaths.has(path) ? SecretService.encrypt(value) : value
    ), '');
    const type = (String(row.key).match(/^integration_(.+)_(?:profiles|providers)$/) || [null, row.key])[1];
    const labels = [];
    collectLabels(type, reencrypted, labels);
    out.push({ key: row.key, group: row.group, value: JSON.stringify(reencrypted), labels });
  }
  process.stdout.write(out.map((o) => JSON.stringify(o)).join('\n') + (out.length ? '\n' : ''));
}

(mode === 'export' ? runExport() : mode === 'import' ? runImport() : Promise.reject(new Error(`unknown mode '${mode}'`)))
  .catch((err) => { console.error(String((err && err.stack) || err)); process.exit(1); });
NODEJS
}

# secrets — integration credentials (Econt, SMTP, payment, anything else configured), source -> the
# imported tenant.
#
# The one thing that has to run "inside the app" is the crypto: SecretService derives its key from
# THIS deployment's own SECRET_KEY/INTEGRATION_SECRET_KEY env var, so the source's ciphertext is only
# ever meaningful to the source's own process, and the target's ciphertext only to the target's. This
# stage never handles a raw encrypted value itself and never reimplements decryption: it runs the
# decrypt call inside the source's own api container, streams the RESULT straight into the target's
# own api container over ONE ssh-to-ssh pipe, and re-encrypts there — the same "stream through this
# machine, never land on it" shape `pull` already uses for the database dump.
#
# What DOES land in a local shell variable afterward is the OUTPUT of the target's re-encryption —
# ciphertext under the TARGET's own key, plus field-presence labels. That is the same status the
# archive itself already carries (meaningless without the key that made it, and that key never
# leaves its own box) — it is not the plaintext this stage exists to keep off this machine, and it is
# never echoed, logged, or written to a file.
#
# Which leaf is a secret is decided by whether the SOURCE had it encrypted, never a hand-maintained
# field-name list or a provider/courier name — so this carries email, payment, or any future
# integration type exactly the way it carries shipping, with no change here if one is added.
stage_secrets() {
  local mode="${2:-}"
  say "secrets — integration credentials, source -> imported tenant"

  local tid; tid=$(tenant_id)
  if [ -z "$tid" ]; then
    echo "   Tenant '$SITE_SLUG' does not exist on the platform yet. Nothing to write into." >&2
    echo "   Run the import first (see '$0 swap')." >&2
    exit 2
  fi
  echo "   tenant: $SITE_SLUG ($tid)"

  # Discovered, not listed: every _system_meta key shaped like an integration profile/provider
  # store. A hand-listed set of types goes stale the moment a plugin adds one — same reasoning as
  # `check`'s schema-driven money-column scan.
  local keys
  keys=$(source_box "docker exec $SOURCE_DB_CONTAINER psql -U $SOURCE_DB_USER -d $SOURCE_DB_NAME -tAc \"
    SELECT key FROM _system_meta WHERE key ~ '^integration_.+_(profiles|providers)\$' ORDER BY key\"" \
    | tr -d '\r' | sed '/^$/d')

  if [ -z "$keys" ]; then
    echo "   No integration profile/provider rows exist on the source. Nothing to transfer." >&2
    echo "   Refusing to write an empty config over whatever is already on the target." >&2
    exit 2
  fi
  echo "   found on source:"
  while IFS= read -r k; do echo "     $k"; done <<< "$keys"

  if [ "$mode" = "--dry-run" ] || [ "$mode" = "--plan" ]; then
    echo
    echo "   PLAN ONLY — the key list above is everything read. Nothing decrypted, nothing written."
    echo "   Would decrypt each row inside $SOURCE_API_CONTAINER (source's own SecretService), stream"
    echo "   it to $TARGET_HOST, re-encrypt inside the target api container (target's own"
    echo "   SecretService), and upsert into _system_meta for tenant $tid, keyed by (key, tenant_id)."
    return 0
  fi

  _secret_transfer_js | source_box "docker exec -i $SOURCE_API_CONTAINER sh -c 'cat > /app/fc-secret-transfer.js'"
  _secret_transfer_js | target_api "sh -c 'cat > /app/fc-secret-transfer.js'"

  # One flat SQL string, built once: `\\\"group\\\"` (not `\"group\"`) is deliberate. `group` is a
  # reserved word and needs a quoted identifier INSIDE the same shell-quoted `-tAc "..."` argument
  # this file already uses everywhere else — that is TWO nested levels of the same quote character,
  # and reaching the remote psql with a literal `"group"` needs the doubled escaping. Verified against
  # a local `bash -c` simulation of exactly this composition before trusting it; get this wrong and
  # the query is a syntax error, not a silent wrong answer.
  local rows_query="SELECT string_agg(json_build_object('key', key, 'group', \\\"group\\\", 'value', value)::text, E'\n') FROM _system_meta WHERE key ~ '^integration_.+_(profiles|providers)\$'"

  # The one pipe: fetch (still encrypted) then decrypt, both on the SOURCE box inside its own api
  # container; then straight into the TARGET's own api container to re-encrypt. Plaintext exists only
  # inside this pipe, and only until the target side turns it back into ciphertext under its own key.
  local encrypted_rows
  encrypted_rows=$(source_box "docker exec $SOURCE_DB_CONTAINER psql -U $SOURCE_DB_USER -d $SOURCE_DB_NAME -tAc \"$rows_query\" \
      | docker exec -i $SOURCE_API_CONTAINER node /app/fc-secret-transfer.js export" \
    | target_api "node /app/fc-secret-transfer.js import")

  if [ -z "$encrypted_rows" ]; then
    echo "   The export/re-encrypt pipe returned nothing. Nothing was written." >&2
    exit 1
  fi

  # Base64 in transit, local-only, ciphertext-only: this unpacks the target's own JSON report, never
  # the source's. A value containing a quote or a newline cannot corrupt the next field this way.
  local tsv
  tsv=$(ENCRYPTED_ROWS="$encrypted_rows" python3 - <<'PY'
import base64, json, os
for line in os.environ['ENCRYPTED_ROWS'].splitlines():
    line = line.strip()
    if not line:
        continue
    row = json.loads(line)
    b64 = base64.b64encode(row['value'].encode()).decode()
    labels = '\x1f'.join(row.get('labels') or [])
    print('\t'.join([row['key'], row.get('group') or 'integrations', b64, labels]))
PY
  )

  # Written with plain psql, like every other write in this file — the encrypt step already did the
  # one thing that needed "the app"; the database does not care who wrote the SQL. (key, tenant_id)
  # is the declared uniqueness on `_system_meta`, so this is a genuine upsert: re-running overwrites
  # the same row instead of duplicating a profile or leaving a stale one next to it, and
  # `activeProfileId` is never touched here — it travels only as part of the source's own JSON.
  local wrote=0
  while IFS=$'\t' read -r row_key row_group row_b64 row_labels; do
    [ -n "$row_key" ] || continue
    local row_value; row_value=$(printf '%s' "$row_b64" | base64 -d)
    local esc_key esc_group esc_value
    esc_key=${row_key//\'/\'\'}
    esc_group=${row_group//\'/\'\'}
    esc_value=${row_value//\'/\'\'}
    # The SQL goes in on STDIN, never as a shell argument: the value is JSON, and every double
    # quote in it is eaten by the remote shell when the statement travels as `psql -c "..."` through
    # ssh. That is not cosmetic — it stored `{providers:[{id:econt,...}]}`, a Postgres array literal
    # that `::jsonb` then refuses, so the row reads as corrupt rather than as a config.
    printf 'INSERT INTO _system_meta (key, value, "group", tenant_id, updated_at) VALUES ('"'"'%s'"'"','"'"'%s'"'"','"'"'%s'"'"','"'"'%s'"'"', now()) ON CONFLICT (key, tenant_id) DO UPDATE SET value = EXCLUDED.value, "group" = EXCLUDED."group", updated_at = now();\n' \
      "$esc_key" "$esc_value" "$esc_group" "$tid" \
      | target_db "psql -U fromcode -d fromcode -v ON_ERROR_STOP=1 -f -" >/dev/null
    wrote=$((wrote + 1))
    if [ -n "$row_labels" ]; then
      # BSD `tr` (macOS, where this script is run) does not understand \x1f: it takes the set
      # LITERALLY as the characters \, x, 1 and f, so every "f" in a label became a newline and the
      # report read "de<nl>aultWeight" / "bank_trans<nl>er". ANSI-C quoting hands tr the real byte.
      printf '%s\n' "$row_labels" | tr $'\037' '\n' | sed 's/^/   /'
    fi
  done <<< "$tsv"

  echo
  echo "   wrote $wrote integration row(s) for tenant $tid."
  echo "   Re-run any time — each key is upserted by (key, tenant_id), never duplicated."
}

case "${1:-dry}" in
  pull)  stage_pull ;;
  build) stage_build ;;
  fetch) stage_fetch ;;
  mark)  stage_mark ;;
  check) stage_check ;;
  verify) stage_verify ;;
  secrets) stage_secrets "$@" ;;
  swap)  stage_swap "$@" ;;
  dry)   stage_pull; stage_build; stage_report; stage_fetch
         say "STOPPED before stage 3 (swap)"
         echo "   Nothing on the platform has been touched. Review the listing above, then run:"
         echo "     $0 swap" ;;
  *)     cat >&2 <<EOF
usage: $0 <stage>

  pull           snapshot the source db + uploads, streamed to the target
  build          restore into a scratch db, write the archive
  fetch          download the archive here (only needed for a browser import)
  dry            pull + build + report + fetch, then STOP

  swap           preview the import — writes NOTHING
  swap execute   run it (refuses while the tenant still exists; delete it in the admin first)
                 (also runs mark, check and secrets, in that order, once the import succeeds)
  secrets        integration credentials (Econt, SMTP, ...), source -> the imported tenant
  secrets --dry-run   list the integration keys found on the source; read and write NOTHING
  mark           prove the non-production brake was on at creation
  check          row counts, scratch db vs imported tenant
  verify         money, natural keys and the invoice series — the half of §8 a machine can do

No argument defaults to 'dry', which CONTACTS BOTH BOXES and re-pulls the snapshot.
EOF
         exit 2 ;;
esac
