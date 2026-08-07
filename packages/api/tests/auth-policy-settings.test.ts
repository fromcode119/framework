import { SystemConstants } from '@fromcode119/core';
import { SystemController } from '@api/controllers/system/system-controller';
import { AuthControllerPolicy } from '@api/controllers/auth/auth-controller-policy';

/**
 * The auth policy, end to end: what the admin Security screen PUTs is what
 * `AuthControllerPolicy` enforces on the next request.
 *
 * These 15 keys were seeded, described and enforced live while `updateSettings` rejected every one of
 * them with `400 Unknown or read-only settings key(s)` and nothing rendered them — a password and
 * lockout policy the operator could neither see nor change. Storing the value is not the fix; the
 * assertions below save through the real controller and then read the policy back through the real
 * policy code, so a key that persists without changing behaviour fails here.
 */

/** A `_system_meta` stand-in shared by the settings controller and the auth policy. */
class MetaTableStub {
  readonly rows = new Map<string, string>();

  async find(): Promise<Array<{ key: string; value: string }>> {
    return [...this.rows].map(([key, value]) => ({ key, value }));
  }

  async findOne(_table: string, where: { key: string }): Promise<{ key: string; value: string } | null> {
    const value = this.rows.get(where.key);
    return value === undefined ? null : { key: where.key, value };
  }

  async update(_table: string, where: { key: string }, data: { value: string }): Promise<boolean> {
    this.rows.set(where.key, data.value);
    return true;
  }

  async insert(_table: string, data: { key: string; value: string }): Promise<boolean> {
    this.rows.set(data.key, data.value);
    return true;
  }

  async delete(_table: string, where: { key: string }): Promise<boolean> {
    return this.rows.delete(where.key);
  }
}

/** Exposes the protected policy readers so a test can ask what the platform will actually do. */
class PolicyProbe extends AuthControllerPolicy {
  readPasswordPolicy() {
    return this.getPasswordPolicySettings();
  }

  readLoginThrottle() {
    return this.getLoginThrottleSettings();
  }

  readSessionMinutes() {
    return this.getSessionDurationMinutes();
  }

  readSettingNumber(key: string, fallback: number, min: number, max: number) {
    return this.getSettingNumber(key, fallback, min, max);
  }

  readSettingBoolean(key: string, fallback: boolean) {
    return this.getSettingBoolean(key, fallback);
  }

  checkPassword(password: string) {
    return this.validatePasswordAgainstPolicy(password);
  }
}

const createSettingsController = (meta: MetaTableStub) => {
  const manager: any = {
    hooks: { on: vi.fn(), emit: vi.fn(), call: vi.fn() },
    audit: { logAction: vi.fn() },
    getAdminMetadata: vi.fn().mockResolvedValue({ plugins: [], menu: [] }),
    getRuntimeModules: vi.fn().mockReturnValue({}),
    db: meta,
  };
  const themeManager: any = { getFrontendMetadata: vi.fn().mockResolvedValue({}) };
  return new SystemController(manager, themeManager, {} as any, {} as any);
};

const createPolicy = (meta: MetaTableStub) => {
  const manager: any = { db: meta, hooks: { call: vi.fn() } };
  const auth: any = { comparePassword: vi.fn().mockResolvedValue(false) };
  return new PolicyProbe(manager, auth);
};

const createRes = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis() }) as any;

/** Save through the real settings endpoint, exactly as the Security screen does. */
const save = async (meta: MetaTableStub, body: Record<string, string>) => {
  const res = createRes();
  await createSettingsController(meta).updateSettings({ body, user: { id: 1 } } as any, res);
  return res;
};

/** Every key the Security screen owns, with a value that is NOT its seeded default. */
const CHANGED: ReadonlyArray<readonly [string, string]> = [
  [SystemConstants.META_KEY.AUTH_PASSWORD_MIN_LENGTH, '16'],
  [SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_UPPERCASE, 'false'],
  [SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_LOWERCASE, 'false'],
  [SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_NUMBER, 'false'],
  [SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_SYMBOL, 'true'],
  [SystemConstants.META_KEY.AUTH_PASSWORD_HISTORY, '12'],
  [SystemConstants.META_KEY.AUTH_PASSWORD_BREACH_CHECK, 'true'],
  [SystemConstants.META_KEY.AUTH_LOCKOUT_THRESHOLD, '9'],
  [SystemConstants.META_KEY.AUTH_LOCKOUT_WINDOW_MINUTES, '45'],
  [SystemConstants.META_KEY.AUTH_LOCKOUT_DURATION_MINUTES, '120'],
  [SystemConstants.META_KEY.AUTH_CAPTCHA_ENABLED, 'true'],
  [SystemConstants.META_KEY.AUTH_CAPTCHA_THRESHOLD, '2'],
  [SystemConstants.META_KEY.AUTH_PASSWORD_RESET_TOKEN_MINUTES, '15'],
  [SystemConstants.META_KEY.AUTH_EMAIL_CHANGE_TOKEN_MINUTES, '90'],
  [SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS, 'false'],
];

describe('auth policy settings — the PUT the Security screen makes', () => {
  it.each(CHANGED)('accepts and persists %s', async (key, value) => {
    const meta = new MetaTableStub();
    const res = await save(meta, { [key]: value });

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(meta.rows.get(key)).toBe(value);
  });

  it('accepts all fifteen in ONE payload, the way "Update Security" sends them', async () => {
    const meta = new MetaTableStub();
    const res = await save(meta, Object.fromEntries(CHANGED));

    expect(res.json).toHaveBeenCalledWith({ success: true });
    for (const [key, value] of CHANGED) expect(meta.rows.get(key)).toBe(value);
  });

  it('still rejects a key the platform does not declare', async () => {
    const meta = new MetaTableStub();
    const res = await save(meta, { auth_password_make_it_up: '1' });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(meta.rows.has('auth_password_make_it_up')).toBe(false);
  });
});

describe('auth policy settings — the policy HONOURS what was saved', () => {
  it('reads back the whole password policy the operator just saved', async () => {
    const meta = new MetaTableStub();
    await save(meta, Object.fromEntries(CHANGED));

    expect(await createPolicy(meta).readPasswordPolicy()).toEqual({
      minLength: 16,
      requireUppercase: false,
      requireLowercase: false,
      requireNumber: false,
      requireSymbol: true,
      historyCount: 12,
      breachCheck: true,
    });
  });

  it('reads back the whole login throttle the operator just saved', async () => {
    const meta = new MetaTableStub();
    await save(meta, Object.fromEntries(CHANGED));

    expect(await createPolicy(meta).readLoginThrottle()).toEqual({
      threshold: 9,
      windowMinutes: 45,
      lockoutMinutes: 120,
      captchaEnabled: true,
      captchaThreshold: 2,
    });
  });

  it('rejects a password that passed under the old minimum and fails the new one', async () => {
    const meta = new MetaTableStub();
    expect(await createPolicy(meta).checkPassword('Abcdef1g')).toBeNull();

    await save(meta, { [SystemConstants.META_KEY.AUTH_PASSWORD_MIN_LENGTH]: '16' });

    expect(await createPolicy(meta).checkPassword('Abcdef1g')).toContain('at least 16');
  });

  it('stops demanding a symbol the moment the toggle is turned off, and demands it when on', async () => {
    const meta = new MetaTableStub();
    await save(meta, { [SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_SYMBOL]: 'true' });
    expect(await createPolicy(meta).checkPassword('Abcdef1ghij')).toContain('symbol');

    await save(meta, { [SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_SYMBOL]: 'false' });
    expect(await createPolicy(meta).checkPassword('Abcdef1ghij')).toBeNull();
  });

  it('applies a changed session duration to the next session', async () => {
    const meta = new MetaTableStub();
    await save(meta, { [SystemConstants.META_KEY.AUTH_SESSION_DURATION]: '60' });

    expect(await createPolicy(meta).readSessionMinutes()).toBe(60);
  });

  it('applies the changed reset and email-change link lifetimes', async () => {
    const meta = new MetaTableStub();
    await save(meta, Object.fromEntries(CHANGED));
    const policy = createPolicy(meta);

    expect(await policy.readSettingNumber(SystemConstants.META_KEY.AUTH_PASSWORD_RESET_TOKEN_MINUTES, 30, 5, 1440)).toBe(15);
    expect(await policy.readSettingNumber(SystemConstants.META_KEY.AUTH_EMAIL_CHANGE_TOKEN_MINUTES, 60, 10, 1440)).toBe(90);
  });

  it('turns security notification emails off when the toggle is off', async () => {
    const meta = new MetaTableStub();
    await save(meta, { [SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS]: 'false' });

    expect(await createPolicy(meta).readSettingBoolean(SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS, true)).toBe(false);
  });

  it('clamps to the same bounds the admin controls offer, so a saved value is never silently rewritten', async () => {
    const meta = new MetaTableStub();
    const policy = createPolicy(meta);

    // The admin min/max for these are 8-128 and 0-20; both ends round-trip unchanged.
    await save(meta, { [SystemConstants.META_KEY.AUTH_PASSWORD_MIN_LENGTH]: '128' });
    expect((await policy.readPasswordPolicy()).minLength).toBe(128);

    await save(meta, { [SystemConstants.META_KEY.AUTH_PASSWORD_HISTORY]: '20' });
    expect((await policy.readPasswordPolicy()).historyCount).toBe(20);

    await save(meta, { [SystemConstants.META_KEY.AUTH_PASSWORD_HISTORY]: '0' });
    expect((await policy.readPasswordPolicy()).historyCount).toBe(0);
  });
});
