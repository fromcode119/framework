/**
 * A code path tried to read a SITE-scoped setting as though it were platform-wide.
 *
 * Thrown by {@link PlatformSettingsService.getSetting} — the runtime half of the guard the
 * {@link SystemSettingRegistry} exists for. The compile-time half (every `META_KEY` needs a
 * descriptor) cannot catch a key whose descriptor says SITE being read by code that assumes
 * PLATFORM; this is the assertion that fires at boot instead of silently reading the wrong row.
 */
export class PlatformSettingScopeError extends Error {
  constructor(key: string) {
    super(
      `"${key}" is declared SITE-scoped in SystemSettingRegistry, but was read through `
      + 'PlatformSettingsService, which only ever sees the platform row. Either the caller is wrong '
      + '(read it per-tenant instead) or the scope is wrong (declare it PLATFORM in '
      + 'system-setting-registry.ts) — never both an omission from a hand-written list.',
    );
  }
}
