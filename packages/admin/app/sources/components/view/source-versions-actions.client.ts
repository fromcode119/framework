import { bound } from '@fromcode119/react-class-components';
import { SourcesApi } from '@/app/sources/sources-api';
import { SourceVersionsState } from '@/app/sources/components/view/source-versions-state.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the version panel can do: read the versions a source has staged, install one, and turn
 * automatic updates on or off.
 *
 * Installing REPLACES code that is serving, which is why it is a deliberate choice of version rather
 * than a button that takes the newest.
 */
export abstract class SourceVersionsActions extends SourceVersionsState {
  /**
   * Reads the versions when the row opens.
   *
   * Not part of the polled list payload: it reads the staging directory of every source on the box,
   * and the list refreshes on a timer. One row, when asked.
   */
  async componentDidMount(): Promise<void> {
    try {
      await this.loadVersions();
    } finally {
      this.loadingVersions = false;
    }
  }

  @bound
  chooseVersion(version: string): void {
    this.chosenVersion = version;
  }

  /** Puts the chosen version in place, then shows what is installed now rather than assuming. */
  @bound
  async installChosen(): Promise<void> {
    const version = this.chosenVersion;
    if (!version || this.installing) return;

    this.installing = version;
    this.versionError = '';
    try {
      const answer = await SourcesApi.installVersion(this.type, this.slug, version);
      this.versions = {
        installed: answer?.installed ?? null,
        built: answer?.built ?? null,
        available: Array.isArray(answer?.available) ? answer.available : (this.versions?.available ?? []),
      };
    } catch (err: any) {
      this.versionError = String(err?.message || AdminI18n.t('sources.couldNotInstallThatVersion'));
      // A FAILED install is exactly when the snapshot must be refreshed rather than kept. An install
      // can fail after the package is already in place — the plugin's own init throwing, say — and the
      // stale snapshot then still names the old version as installed, which disables the button that
      // would put it back. The one moment a rollback is needed is the one moment it was unavailable.
      await this.loadVersions();
    } finally {
      this.installing = null;
    }
  }

  /** Reads the three facts fresh. Separate from the toggle so both open and failure can call it. */
  protected async loadVersions(): Promise<void> {
    try {
      const answer = await SourcesApi.versions(this.type, this.slug);
      this.versions = {
        installed: answer?.installed ?? null,
        built: answer?.built ?? null,
        available: Array.isArray(answer?.available) ? answer.available : [],
      };
      if (!this.chosenVersion || !this.versions.available.includes(this.chosenVersion)) {
        this.chosenVersion = this.versions.available[0] ?? '';
      }
    } catch {
      // Leave whatever is on screen: a failed refresh must not blank the panel the operator is reading.
    }
  }

  /**
   * Turns automatic updating on or off for this source, from the screen that is about versions.
   *
   * The same setting lives in Edit, where it is the second half of a pair and reads as
   * "Update if already installed" — accurate, and findable only by someone who already knows the
   * chain. This is where an operator looks when asking "keep this current", so it is offered here too,
   * writing the same field. Switching it ON also sets `installAfterBuild`, because the installer is
   * only reached inside that branch and the flag alone does nothing.
   */
  @bound
  async toggleAutoUpdate(next: boolean): Promise<void> {
    if (this.savingAutoUpdate) return;
    this.savingAutoUpdate = true;
    this.versionError = '';
    try {
      await SourcesApi.update(this.type, this.slug, next
        ? { autoUpdate: true, installAfterBuild: true }
        : { autoUpdate: false });
      this.autoUpdating = next;
    } catch (err: any) {
      this.versionError = String(err?.message || AdminI18n.t('sources.couldNotChangeAutomaticUpdating'));
    } finally {
      this.savingAutoUpdate = false;
    }
  }
}
