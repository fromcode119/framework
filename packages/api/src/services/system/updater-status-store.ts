import { SystemConstants, UpdaterState } from '@fromcode119/core';

/**
 * The two platform settings the updater and Settings → Updates share: the version an operator asked for,
 * and the updater's last report. Both are written here and nowhere else, so neither can be typed in.
 */
export class UpdaterStatusStore {
  /** An updater that has not reported for this long is not running; the screen says so instead of waiting. */
  static readonly SILENT_AFTER_MS = 5 * 60 * 1000;
  private static readonly FINISHED = [UpdaterState.SUCCEEDED.value, UpdaterState.FAILED.value, UpdaterState.ROLLED_BACK.value];

  constructor(private readonly db: any) {}

  async request(version: string): Promise<void> {
    await this.write(SystemConstants.META_KEY.FRAMEWORK_UPDATE_REQUEST, version);
  }

  async requested(): Promise<string> {
    return (await this.read(SystemConstants.META_KEY.FRAMEWORK_UPDATE_REQUEST)) ?? '';
  }

  /** Stores a report as received, stamped; a finished update of the requested version clears the request. */
  async report(input: Record<string, unknown>): Promise<void> {
    const text = (value: unknown, max = 500) => String(value ?? '').slice(0, max);
    const status = {
      state: text(input.state, 20), from: text(input.from, 40), to: text(input.to, 40),
      step: text(input.step), error: text(input.error, 2000),
      startedAt: text(input.startedAt, 40), finishedAt: text(input.finishedAt, 40),
      reportedAt: new Date().toISOString(),
    };
    // A restarted updater reports `idle` with no memory of its last update. The OUTCOME is kept — it is
    // what stops a failed version from being retried every minute — and only the heartbeat moves.
    const previous = await this.status();
    const keepOutcome = status.state === UpdaterState.IDLE.value && !status.step && previous && UpdaterStatusStore.FINISHED.includes(previous.state);
    await this.write(SystemConstants.META_KEY.FRAMEWORK_UPDATE_STATUS, JSON.stringify(keepOutcome ? { ...previous, reportedAt: status.reportedAt } : status));
    const requested = (await this.requested()).replace(/^v/, '');
    if (requested && UpdaterStatusStore.FINISHED.includes(status.state) && status.to.replace(/^v/, '') === requested) {
      await this.write(SystemConstants.META_KEY.FRAMEWORK_UPDATE_REQUEST, '');
    }
  }

  async status(): Promise<Record<string, string> | null> {
    try {
      return JSON.parse((await this.read(SystemConstants.META_KEY.FRAMEWORK_UPDATE_STATUS)) ?? '');
    } catch {
      return null;
    }
  }

  static isRunning(status: Record<string, string> | null, now = Date.now()): boolean {
    const at = Date.parse(String(status?.reportedAt ?? ''));
    return Number.isFinite(at) && now - at < UpdaterStatusStore.SILENT_AFTER_MS;
  }

  private async read(key: string): Promise<string | null> {
    return this.db.withPlatformAdmin(async () => {
      const rows = await this.db.find(SystemConstants.TABLE.META, { where: { key } });
      const row = (Array.isArray(rows) ? rows : []).find((entry: any) => (entry?.tenant_id ?? entry?.tenantId ?? null) === null);
      return row ? String(row.value ?? '') : null;
    });
  }

  private async write(key: string, value: string): Promise<void> {
    await this.db.withPlatformAdmin(async () => {
      if ((await this.read(key)) !== null) {
        await this.db.update(SystemConstants.TABLE.META, { key }, { value });
        return;
      }
      await this.db.insert(SystemConstants.TABLE.META, { key, value });
    });
  }
}
