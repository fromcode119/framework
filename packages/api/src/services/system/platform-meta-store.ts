import { SystemConstants } from '@fromcode119/core';

/**
 * Reads and writes ONE platform-level `_system_meta` row (the one no site owns), as the platform.
 *
 * The updater's report and the plugin updater's report are values the api writes and Settings → Updates
 * only displays, so they go through here and nowhere else — a value nobody can type in cannot be forged.
 */
export class PlatformMetaStore {
  constructor(private readonly db: any) {}

  async read(key: string): Promise<string | null> {
    return this.db.withPlatformAdmin(async () => {
      const rows = await this.db.find(SystemConstants.TABLE.META, { where: { key } });
      const row = (Array.isArray(rows) ? rows : []).find((entry: any) => (entry?.tenant_id ?? entry?.tenantId ?? null) === null);
      return row ? String(row.value ?? '') : null;
    });
  }

  async write(key: string, value: string): Promise<void> {
    await this.db.withPlatformAdmin(async () => {
      if ((await this.read(key)) !== null) {
        await this.db.update(SystemConstants.TABLE.META, { key }, { value });
        return;
      }
      await this.db.insert(SystemConstants.TABLE.META, { key, value });
    });
  }
}
