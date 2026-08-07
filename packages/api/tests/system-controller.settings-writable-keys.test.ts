import { SystemConstants, SystemSettingsExposureUtils } from '@fromcode119/core';
import { SystemController } from '@api/controllers/system/system-controller';

/** A `_system_meta` stand-in that records what updateSettings actually wrote. */
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
}

const createController = (meta: MetaTableStub) => {
  const manager: any = {
    hooks: { on: vi.fn(), emit: vi.fn() },
    audit: { logAction: vi.fn() },
    getAdminMetadata: vi.fn().mockResolvedValue({ plugins: [], menu: [] }),
    getRuntimeModules: vi.fn().mockReturnValue({}),
    db: meta,
  };
  const themeManager: any = { getFrontendMetadata: vi.fn().mockResolvedValue({}) };
  return new SystemController(manager, themeManager, {} as any, {} as any);
};

const createRes = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis() }) as any;

describe('SystemAdminController.updateSettings — measurement_system', () => {
  it('accepts measurement_system and persists it (the Localization save was a 400 without this)', async () => {
    const meta = new MetaTableStub();
    const controller = createController(meta);
    const res = createRes();

    await controller.updateSettings(
      { body: { [SystemConstants.META_KEY.MEASUREMENT_SYSTEM]: 'imperial' }, user: { id: 1 } } as any,
      res,
    );

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(meta.rows.get(SystemConstants.META_KEY.MEASUREMENT_SYSTEM)).toBe('imperial');
  });

  it('round-trips: what the Localization page saves is what getSettings reads back', async () => {
    const meta = new MetaTableStub();
    const controller = createController(meta);

    await controller.updateSettings(
      {
        body: {
          [SystemConstants.META_KEY.MEASUREMENT_SYSTEM]: 'imperial',
          [SystemConstants.META_KEY.LOCALE_URL_STRATEGY]: 'path',
        },
        user: { id: 1 },
      } as any,
      createRes(),
    );

    const readRes = createRes();
    await controller.getSettings({} as any, readRes);

    expect(readRes.json).toHaveBeenCalledWith(expect.objectContaining({
      [SystemConstants.META_KEY.MEASUREMENT_SYSTEM]: 'imperial',
      [SystemConstants.META_KEY.LOCALE_URL_STRATEGY]: 'path',
    }));
  });

  it('is exposable, so the saved value can reach the admin and plugins that read it', () => {
    expect(SystemSettingsExposureUtils.isExposable(SystemConstants.META_KEY.MEASUREMENT_SYSTEM)).toBe(true);
  });

  it('still rejects a key no control produces', async () => {
    const controller = createController(new MetaTableStub());
    const res = createRes();

    await controller.updateSettings({ body: { 'user:1:totp_secret': 'x' }, user: { id: 1 } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
