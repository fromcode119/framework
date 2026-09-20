# Migrating a site onto the platform

Moving a single-tenant deployment — its own database, its own uploads — onto a multi-tenant platform
as one site.

The destination must be **Postgres**. Tenant isolation is enforced by row-level security, which MySQL
has no equivalent for, so a multi-tenant deployment refuses to boot on it. The source may be
Postgres or SQLite; the archive is what makes the source's dialect stop mattering.

## Before you start

- **Install the plugins and theme the source runs, on the destination, first.** Rows whose owning
  plugin is not installed have nowhere to go and are skipped. The preview names them.
- **Both deployments need `SECRET_KEY` set.** Each encrypts its own secrets with it.
- **Decide the transit passphrase.** See *Credentials*, below.

## The order

1. **Export**, on the source, or from a restored copy of its dump when the source cannot be reached:

   ```bash
   TENANT_TRANSIT_PASSPHRASE='…' node dist/cli/tenant-export.js \
     --database "postgres://…"  --uploads /app/public/uploads \
     --slug acme --host acme.example.com \
     --platform "postgres://…destination…" \
     --out /tmp/acme.tar.gz
   ```

   `--platform` is the DESTINATION: the export asks it which tables a tenant has, because the source
   has no tenancy to discover that from.

2. **Move the archive** to the destination. It carries ciphertext only; the passphrase travels
   separately, by whatever means you would send a password.

3. **Preview**, which writes nothing:

   ```bash
   node dist/cli/tenant-import.js --archive /tmp/acme.tar.gz
   ```

   Read what it says about what arrives, what does not, and what is already there.

4. **Import**:

   ```bash
   TENANT_TRANSIT_PASSPHRASE='…' node dist/cli/tenant-import.js --archive /tmp/acme.tar.gz --execute
   ```

   The site arrives **non-production and private**: no email, payment, courier call or scheduled job
   leaves it, and anonymous visitors get a holding page.

5. **Check it**, in the admin: content, media, orders, the integrations screen.

6. **Publish**, when you are satisfied — the environment and visibility are the two switches on the
   site's own page, and the only steps a customer can see.

## Importing it again

An import refuses while a site of that id already exists, so a second run means removing the first
one. That used to need the admin, which put one manual click in the middle of an otherwise headless
pipeline. It no longer does:

```bash
node dist/cli/tenant-delete.js --id acme --confirm acme            # preview: writes NOTHING
node dist/cli/tenant-delete.js --id acme --confirm acme --execute  # exports, then deletes
```

`--confirm` takes the site's own slug and is checked before anything is read or written, so a
mistyped `--id` cannot delete the wrong site. The site is **always exported first** — the eraser
refuses to run without an archive on disk, and that archive is the only way back.


## Credentials

A secret is encrypted with the key of the deployment holding it, so a copied credential is
unreadable anywhere else: the integration then behaves exactly as though it had never been
configured, which is a failure that looks like the courier being down.

Set `TENANT_TRANSIT_PASSPHRASE` to the same value for the export and the import. The export reseals
each secret under it; the import takes each one into the destination's own key. The archive never
holds anything readable, and the destination's own key alone does not open it either.

**It is read from the environment, never a flag** — an argument is visible in shell history and to
anyone running `ps`.

Export without it and the secrets still travel, still unreadable; the export says so, the preview
says so, and each integration needs its credential entered again. Import an archive that WAS sealed
without setting it and the import refuses rather than landing credentials nobody can read.

## What to expect, and why

- **Ids are kept.** Each site has its own id space — a table's primary key names the site as well as
  the id — so an archive's order 157 arrives as order 157 no matter who else already holds that
  number. The preview says so per kind, under "Kept".
- **A few tables still renumber.** Where a table's key is still the id alone, the numbers are shared
  with every other site, and rows whose ids overlap what this destination has already handed out get
  new ones, with every declared reference to them re-pointed. The preview names those kinds and shows
  both figures — where the archive starts, and how many this platform has handed out.
- **When something IS renumbered, ids inside free-form JSON are not.** A declared relationship is
  re-pointed; an id buried in a `metadata` blob nothing declares cannot be told from any other number.
  The preview names those columns. On a kind whose ids were kept there is nothing to re-point and
  nothing to miss — which is the reason for keeping them.
- **Display numbers do not change either way** — an order number, an invoice series. They are their
  own fields, not the row id.
- **Uploads are shared and flat.** A file whose name is already taken is stored under a suffixed
  name, never overwriting, and every reference to it — including inside page content — is rewritten
  to match.
- **An older schema's columns fold into the field that replaced them**, where a field declares them
  (`IField.legacyColumns`). A column nothing claims is dropped, and the preview says so.
- **Platform settings do not travel.** Roughly thirty keys belong to a deployment rather than a site
  — URLs, rate limits, retention. The site gets the destination's.
- **People are matched by email.** Someone who already has an account here is linked, not duplicated,
  and arrives with the roles the ARCHIVE gave them, not the ones they have here.

## Traps that have already cost time

- **Querying a tenant-scoped table without setting the scope shows only the UNOWNED rows.** Run it
  both ways before concluding anything from a count — `set_config('app.tenant_id', '<id>', false)`.
  Reading "every row has no tenant" off an unscoped query is the classic wrong conclusion.
- **A hot-installed plugin needs the api restarted** before its storefront bundle serves.
- **On a private site `503` is the healthy answer** — that is the holding page. `500` is the broken
  one. A naive "non-200 means down" check is wrong in both directions.
- **Re-importing over an existing site is refused.** Delete the site in the admin first; that export
  runs on its way out.
