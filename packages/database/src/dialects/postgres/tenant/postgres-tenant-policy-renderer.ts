import { TenantIsolationSql } from '@database/dialects/postgres/tenant/tenant-isolation-sql';
import type { ITenantPolicyRenderer } from '@database/interfaces/tenant-policy-renderer.interface';
import type { JournalPolicySpec } from '@database/tenant/policies/journal-policy-spec';
import type { PlatformKeysVisiblePolicySpec } from '@database/tenant/policies/platform-keys-visible-policy-spec';
import type { SharedReadPolicySpec } from '@database/tenant/policies/shared-read-policy-spec';
import type { TenantSettingsPolicySpec } from '@database/tenant/policies/tenant-settings-policy-spec';
import type { UnownedReadPolicySpec } from '@database/tenant/policies/unowned-read-policy-spec';

/**
 * Renders each declared policy as Postgres DDL.
 *
 * The caller declares the MEANING (a `TenantPolicySpec` subclass); every `CREATE POLICY` is written
 * in `TenantIsolationSql`, where the rest of the Postgres tenancy SQL lives. These were once built
 * in core, which is how `CREATE POLICY` text ended up outside the dialect that owns it.
 *
 * This class is also the exhaustiveness check: it implements `ITenantPolicyRenderer`, so a new
 * policy kind cannot be added without this file failing to compile until it renders one.
 */
export class PostgresTenantPolicyRenderer implements ITenantPolicyRenderer<string[]> {
  sharedRead(spec: SharedReadPolicySpec): string[] {
    return TenantIsolationSql.sharedReadStatements(spec.table, spec.sharedColumn);
  }

  platformKeysVisible(spec: PlatformKeysVisiblePolicySpec): string[] {
    return TenantIsolationSql.platformKeysVisibleStatements(spec.table, spec.keyColumn, spec.platformKeys);
  }

  journal(spec: JournalPolicySpec): string[] {
    return TenantIsolationSql.journalStatements(spec.table);
  }

  tenantSettings(spec: TenantSettingsPolicySpec): string[] {
    return TenantIsolationSql.tenantSettingsStatements(spec.table);
  }

  unownedRead(spec: UnownedReadPolicySpec): string[] {
    return TenantIsolationSql.unownedReadStatements(spec.table);
  }
}
