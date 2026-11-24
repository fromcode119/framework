import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * What an edge proves itself with, instead of a shared password (Settings → Security → Edges).
 *
 * - `_system_edge_ca` — the platform's authority for edges: one root, and the working certificates it
 *   signs edge certificates with. Private keys are encrypted, like every key the platform holds.
 * - `_system_edges` — each edge added to the platform: its name, identity, state and last contact.
 * - `_system_edge_enrollments` — one-time tokens for adding an edge. Only a hash is kept; a token is
 *   used once and expires.
 * - `_system_edge_certificates` — every certificate issued to an edge, so a removed edge's are refused
 *   on every new connection, before they run out.
 *
 * Platform-level, like the TLS certificates: an edge serves every site, so there is no tenant to scope to.
 */
export class EdgeIdentityMigration extends BaseMigration {
  readonly version = 74;
  readonly name = 'Edge identity';
  /** Only new tables: the running release never reads them. */
  readonly rollingSafe = true;

  async up(db: IDatabaseManager): Promise<void> {
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_edge_ca (
        id ${type.autoId},
        kind ${type.shortText} NOT NULL,
        serial ${type.key} NOT NULL,
        certificate_pem ${type.longTextNullable},
        private_key_enc ${type.longTextNullable},
        not_before ${type.timestamp},
        not_after ${type.timestamp},
        created_at ${type.timestamp} DEFAULT ${type.now},
        retired_at ${type.timestamp}
      )`,
    ));
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_edges (
        id ${type.key} PRIMARY KEY,
        name ${type.shortText} NOT NULL,
        created_at ${type.timestamp} DEFAULT ${type.now},
        created_by ${type.shortText},
        enrolled_at ${type.timestamp},
        revoked_at ${type.timestamp},
        revoked_by ${type.shortText},
        last_seen_at ${type.timestamp},
        last_address ${type.shortText},
        version ${type.shortText},
        certificate_serial ${type.shortText},
        certificate_not_after ${type.timestamp}
      )`,
    ));
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_edge_enrollments (
        id ${type.autoId},
        edge_id ${type.key} NOT NULL,
        token_hash ${type.key} NOT NULL,
        expires_at ${type.timestamp} NOT NULL,
        used_at ${type.timestamp},
        created_at ${type.timestamp} DEFAULT ${type.now}
      )`,
    ));
    await db.execute(Sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_enrollments_token ON _system_edge_enrollments (token_hash)'));
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_edge_certificates (
        serial ${type.key} PRIMARY KEY,
        edge_id ${type.key} NOT NULL,
        not_after ${type.timestamp} NOT NULL,
        issued_at ${type.timestamp} DEFAULT ${type.now},
        revoked_at ${type.timestamp}
      )`,
    ));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_edge_certificates_edge ON _system_edge_certificates (edge_id)'));
  }
}
