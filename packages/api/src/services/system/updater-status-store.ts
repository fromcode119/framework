import { SystemConstants, UpdaterState } from '@fromcode119/core';
import { PlatformMetaStore } from '@api/services/system/platform-meta-store';

/**
 * The two platform settings the updater and Settings → Updates share: the version an operator asked for,
 * and the updater's last report. Both are written here and nowhere else, so neither can be typed in.
 */
export class UpdaterStatusStore {
  /** An updater that has not reported for this long is not running; the screen says so instead of waiting. */
  static readonly SILENT_AFTER_MS = 5 * 60 * 1000;
  private static readonly MAX_STEPS = 40;
  private static readonly FINISHED = [UpdaterState.SUCCEEDED.value, UpdaterState.FAILED.value, UpdaterState.ROLLED_BACK.value];
  /** Outcomes a restarted updater's `idle` must not erase. HELD keeps its request: the update still waits. */
  private static readonly KEPT = [...UpdaterStatusStore.FINISHED, UpdaterState.HELD.value];

  private readonly meta: PlatformMetaStore;

  constructor(db: any) {
    this.meta = new PlatformMetaStore(db);
  }

  /** `restart`: the operator accepts a restart for this version when rolling is not possible. */
  async request(version: string, restart = false): Promise<void> {
    await this.write(SystemConstants.META_KEY.FRAMEWORK_UPDATE_REQUEST, version);
    await this.write(SystemConstants.META_KEY.FRAMEWORK_UPDATE_RESTART, restart ? version : '');
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
      // How the apps were replaced and why. Without it a restart that took every site down for a minute
      // left nothing behind but "succeeded": the reason lived only in the updater's own log.
      deployMode: text(input.deployMode, 20), deployReason: text(input.deployReason),
      steps: (Array.isArray(input.steps) ? input.steps : []).slice(-UpdaterStatusStore.MAX_STEPS).map((step) => text(step)),
      reportedAt: new Date().toISOString(),
    };
    // A restarted updater reports `idle` with no memory of its last update. The OUTCOME is kept — it is
    // what stops a failed version from being retried every minute — and only the heartbeat moves.
    const previous = await this.status();
    const keepOutcome = status.state === UpdaterState.IDLE.value && !status.step && previous && UpdaterStatusStore.KEPT.includes(previous.state);
    await this.write(SystemConstants.META_KEY.FRAMEWORK_UPDATE_STATUS, JSON.stringify(keepOutcome ? { ...previous, reportedAt: status.reportedAt } : status));
    const requested = (await this.requested()).replace(/^v/, '');
    if (requested && UpdaterStatusStore.FINISHED.includes(status.state) && status.to.replace(/^v/, '') === requested) {
      await this.write(SystemConstants.META_KEY.FRAMEWORK_UPDATE_REQUEST, '');
    }
    // A permission to restart is for one version and one attempt: once anything but HELD ends, it is spent.
    if (UpdaterStatusStore.FINISHED.includes(status.state)) await this.write(SystemConstants.META_KEY.FRAMEWORK_UPDATE_RESTART, '');
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

  private read(key: string): Promise<string | null> {
    return this.meta.read(key);
  }

  private write(key: string, value: string): Promise<void> {
    return this.meta.write(key, value);
  }
}
