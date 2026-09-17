import type { JournalPolicySpec } from '@database/tenant/policies/journal-policy-spec';
import type { PlatformKeysVisiblePolicySpec } from '@database/tenant/policies/platform-keys-visible-policy-spec';
import type { SharedReadPolicySpec } from '@database/tenant/policies/shared-read-policy-spec';
import type { TenantSettingsPolicySpec } from '@database/tenant/policies/tenant-settings-policy-spec';
import type { UnownedReadPolicySpec } from '@database/tenant/policies/unowned-read-policy-spec';

/**
 * Turns a declared policy into whatever a dialect needs — `string[]` of DDL, for Postgres.
 *
 * This interface is the exhaustiveness the discriminated union used to provide, and it is stronger:
 * a new `TenantPolicySpec` subclass cannot be rendered until a method is added here, and adding one
 * breaks every renderer that has not implemented it. With a union, forgetting a `case` needed a
 * `never` check that somebody had to remember to write.
 */
export interface ITenantPolicyRenderer<T> {
  sharedRead(spec: SharedReadPolicySpec): T;
  platformKeysVisible(spec: PlatformKeysVisiblePolicySpec): T;
  journal(spec: JournalPolicySpec): T;
  tenantSettings(spec: TenantSettingsPolicySpec): T;
  unownedRead(spec: UnownedReadPolicySpec): T;
}
