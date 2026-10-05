import { SystemConstants } from '@core/constants/system.constants';
import type { IPluginHealthNotificationData } from '@core/plugin/services/interfaces/plugin-health-notification-data.interface';

/**
 * What the last "plugins need attention" alert was about, so the next boot does not send it again.
 *
 * The alert runs after every boot, and the platform boots on every deploy and every plugin update. A
 * plugin that stayed held for a day therefore produced the same notification and the same email each
 * time, which buried every other notification under repeats of one. It is now sent when the set of
 * flagged plugins CHANGES: a new one is held, one recovers, or a held one's reason or error is
 * different. When everything is healthy the memory is cleared, so a plugin that is held again later
 * is reported again.
 *
 * The memory is a platform fact (the same plugins serve every site), so it is the platform's row in
 * `_system_meta`, written as the platform admin like the schema fingerprints beside it.
 */
export class PluginHealthAlertMemory {
  private static readonly KEY = 'plugin_health_alert';

  constructor(private readonly db: any) {}

  /** The same flagged plugins in any order give the same text; any change to who or why gives another. */
  static fingerprint(summary: IPluginHealthNotificationData): string {
    return summary.plugins
      .map((entry) => [entry.slug, entry.held ? 'held' : 'error', entry.reason ?? '', entry.error ?? ''].join('|'))
      .sort()
      .join('\n');
  }

  /** What the last alert was about; empty when none was sent, or the plugins have been healthy since. */
  async last(): Promise<string> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: PluginHealthAlertMemory.KEY });
    return String(row?.value ?? '');
  }

  async remember(fingerprint: string): Promise<void> {
    await this.db.withPlatformAdmin(async () => {
      const existing = await this.db.findOne(SystemConstants.TABLE.META, { key: PluginHealthAlertMemory.KEY });
      if (existing) {
        await this.db.update(SystemConstants.TABLE.META, { key: PluginHealthAlertMemory.KEY }, { value: fingerprint });
        return;
      }
      await this.db.insert(SystemConstants.TABLE.META, {
        key: PluginHealthAlertMemory.KEY,
        value: fingerprint,
        description: 'The plugins the last "need attention" alert was about',
        group: 'Plugin health',
      });
    });
  }
}
