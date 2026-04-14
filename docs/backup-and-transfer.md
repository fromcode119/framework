# Backup And Site Transfer

This guide covers the framework-owned backup management APIs and the initial site-transfer bundle workflow.

## Admin Backup API

Authorized operators now have a dedicated system backup API surface under `/api/v1/system/admin/backups`.

- `GET /api/v1/system/admin/backups`
  Returns grouped backup metadata with stable ids for system, plugin, theme, and database backups.
- `POST /api/v1/system/admin/backups/system`
  Creates a new full system snapshot using the shared core backup service.
- `GET /api/v1/system/admin/backups/:id/download`
  Streams a selected backup archive after `system:backup:view` validation.
- `DELETE /api/v1/system/admin/backups/:id`
  Deletes a managed backup archive beneath `backups/` after `system:backup:manage` validation.
- `POST /api/v1/system/admin/backups/:id/restore/preview`
  Validates the backup id and target kind and returns the required confirmation challenge.
- `POST /api/v1/system/admin/backups/:id/restore/execute`
  Revalidates the target, checks the typed confirmation text, creates a safety snapshot, and performs the restore.

Restore targets are constrained to `system`, `plugin:<slug>`, and `theme:<slug>`. Raw destination paths are never accepted from the client.

Compatibility is strict:

- System backups restore only to `system`.
- Plugin backups restore only to `plugin:<same-slug>`.
- Theme backups restore only to `theme:<same-slug>`.

## Backup Permissions

The following permissions are seeded by migration version `7`:

- `system:backup:view`
- `system:backup:manage`
- `system:backup:restore`

The migration also maps all three permissions to the `admin` role.

## Site Transfer Bundle

The supported runtime path is the framework CLI surface:

```bash
npm run fromcode -- system site-transfer-bundle --label demo-transfer
```

The thin wrapper script delegates to the same CLI runtime:

```bash
npm run bundle:site-transfer -- --label demo-transfer
```

### Default Output

Bundles default to the repository-root artifacts directory:

```text
artifacts/site-transfer/<timestamp>-<label>/
```

The staging directory contains:

- `site-snapshot.tar.gz`
- `manifest.json`
- `import-instructions.md`
- `required-environment-keys.txt`
- `checksums.txt` unless `--skip-checksum` is used
- `<label>.tar.gz` final bundle archive
- `bundle-status.json` with `complete` or `incomplete` state

### Flags

- `--output <dir>`: Override the staging root.
- `--label <label>`: Apply a readable bundle suffix.
- `--include-public`: Include `public/` in the generated system snapshot.
- `--include-uploads`: Include `public/uploads` when `--include-public` is set. Without this flag, other `public/` assets stay included and only `public/uploads` is excluded.
- `--include-secrets`: Include `secrets/` in the generated system snapshot. This is unsafe and should only be used deliberately.
- `--skip-checksum`: Skip checksum generation for staged artifacts.

### Safety Notes

- Secrets and environment credentials stay excluded by default.
- Required environment variable names are emitted to `required-environment-keys.txt` so destination operators can rebuild secrets outside the bundle.
- Restore execution always creates a pre-restore rollback snapshot before extraction.