import { SettingScope } from '@core/settings/enums/setting-scope.enum';

export interface SystemSettingDescriptor {
  /**
   * Who this setting's value is FOR — see {@link SettingScope}. Decided by WHO READS it: boot,
   * background/cron work, and platform infrastructure (URLs, certificates, isolation, SSR, maintenance,
   * setup, marketplace, repository, workspace root, indexing) are PLATFORM; everything else is SITE.
   * No default — every key must say which, on purpose.
   */
  scope: SettingScope;
  /** May the generic settings PUT accept this key at all? False for credential blobs and internal bookkeeping. */
  writable: boolean;
  /**
   * May this row leave the server in an admin/settings response?
   *
   * `_system_meta` is the framework's key/value scratch space, not a settings table: alongside the
   * operator-visible settings it holds live SMTP and gateway passwords. Exposure used to be decided
   * by a `startsWith('integration_')` test — a PREFIX standing in for a property, which is the same
   * shape of mistake as scope-by-omission: a credential stored under any other prefix would have
   * been served to the admin client automatically. Declared here instead, per key.
   */
  exposed: boolean;
  /**
   * What to write when this setting has never been saved, and how to describe it.
   *
   * Optional on purpose: 49 of the declared keys seed a row and the rest do not, and "no seed" is a
   * real answer — the reader falls back to its own default and no row claims otherwise. Unlike
   * `scope`, an omission here cannot silently misfile anything.
   *
   * `value` may be a thunk for the few defaults that are only knowable at boot (the app URLs come
   * from the environment). It is evaluated once, when the seed runs.
   */
  seed?: { value: string | (() => string); description: string; group: string };
}
