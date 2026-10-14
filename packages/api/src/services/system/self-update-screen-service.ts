import { DeploymentKind, SelfUpdatePlanner, SystemUpdateService } from '@fromcode119/core';
import { UpdaterStatusStore } from '@api/services/system/updater-status-store';

/**
 * What Settings → Updates shows and does on an installation that runs published images.
 *
 * Such an installation cannot replace its own files, so "Update now" is a REQUEST the updater service
 * picks up, and the screen reports what the updater says — including that no updater has reported at
 * all, rather than a button that silently does nothing.
 */
export class SelfUpdateScreenService {
  private readonly store: UpdaterStatusStore;

  constructor(db: any) {
    this.store = new UpdaterStatusStore(db);
  }

  /** The update check, plus the updater's side of it on an image installation. */
  async describe(check: Record<string, any> | null): Promise<Record<string, any> | null> {
    if (!check || !DeploymentKind.isImage) return check;
    const status = await this.store.status();
    return {
      ...check,
      selfUpdate: {
        plan: await SelfUpdatePlanner.plan(SystemUpdateService.installedVersion()),
        requested: await this.store.requested(),
        status,
        updaterRunning: UpdaterStatusStore.isRunning(status),
      },
    };
  }

  /** "Update now" on an image installation: ask the updater for the newest version. */
  async request(): Promise<Record<string, any>> {
    const check = await SystemUpdateService.checkUpdate();
    if (!check?.hasUpdate) throw new Error('No update available');
    const version = String(check.latest).replace(/^v/, '');
    await this.store.request(version);
    return { requested: version, updaterRunning: UpdaterStatusStore.isRunning(await this.store.status()) };
  }
}
