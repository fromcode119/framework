import { describe, expect, it, vi, beforeEach } from 'vitest';

const get = vi.fn();
const put = vi.fn();

vi.mock('@/lib/api', () => ({ AdminApi: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) } }));

const { SecuritySettingsIo } = await import('@/app/settings/security/security-settings-io');
const { SecuritySettingsKeys } = await import('@/app/settings/security/security-settings-keys');

/**
 * Load and save walk the SAME key list.
 *
 * The failure this guards against is not hypothetical: the screen used to name its keys separately in
 * `fetchSettings` and in `handleSave`, so a control could render a value that the Save never sent -
 * "Update Security" reported success and the setting did not move.
 */
describe('SecuritySettingsIo', () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
  });

  it('loads every key the screen owns, as the strings the server sent', async () => {
    get.mockResolvedValue(Object.fromEntries(SecuritySettingsKeys.ALL.map((k) => [k, 'stored'])));

    const loaded = await SecuritySettingsIo.load();

    expect(Object.keys(loaded).sort()).toEqual([...SecuritySettingsKeys.ALL].sort());
    expect(new Set(Object.values(loaded))).toEqual(new Set(['stored']));
  });

  it('reports a missing key as empty rather than inventing a default for it', async () => {
    get.mockResolvedValue({});

    const loaded = await SecuritySettingsIo.load();

    expect(new Set(Object.values(loaded))).toEqual(new Set(['']));
  });

  it('sends every key it loaded, so no control can save without reaching the API', async () => {
    const settings = Object.fromEntries(SecuritySettingsKeys.ALL.map((k) => [k, 'x']));

    await SecuritySettingsIo.save(settings);

    const payload = put.mock.calls[0][1] as Record<string, string>;
    expect(Object.keys(payload).sort()).toEqual([...SecuritySettingsKeys.ALL].sort());
  });

  it('sends a cleared internal-clients list as an empty string, not by omitting the key', async () => {
    const settings = Object.fromEntries(SecuritySettingsKeys.ALL.map((k) => [k, 'x']));
    settings.rate_limit_internal_clients = '';

    await SecuritySettingsIo.save(settings);

    const payload = put.mock.calls[0][1] as Record<string, string>;
    expect(payload).toHaveProperty('rate_limit_internal_clients', '');
  });

  it('lists the fifteen auth policy keys the API enforces', () => {
    const authKeys = SecuritySettingsKeys.ALL.filter((k) => k.startsWith('auth_'));
    expect(authKeys).toHaveLength(16); // the 15 policy keys plus the session duration already on screen
    expect(authKeys).toContain('auth_password_min_length');
    expect(authKeys).toContain('auth_lockout_threshold');
    expect(authKeys).toContain('auth_captcha_threshold');
    expect(authKeys).toContain('auth_security_notifications');
    expect(authKeys).toContain('auth_email_change_token_minutes');
  });
});
