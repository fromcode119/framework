import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import {bound, prop, state, Platform} from '@fromcode119/react-class-components';

import { Button } from '@/components/ui/view/button.client';
import { Select } from '@/components/ui/view/select.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { Download, GitBranch, History, Pencil, Play, Trash2 } from 'lucide-react';
import { BuildStatusBadge } from '@/app/sources/build-status-badge';
import { BuildChangelog } from '@/app/sources/build-changelog';
import { SourcesApi } from '@/app/sources/sources-api';

export class BuildSourceListItem extends AdminComponent {
  declare props: {
    build: any; deletingKey: string | null; onDelete: (build: any) => void;
    onEdit: (build: any) => void; onTrigger: (build: any) => void; triggerKey: string | null;
  };
  @prop declare build: any;
  @prop declare deletingKey: string | null;
  @prop declare onDelete: (build: any) => void;
  @prop declare onEdit: (build: any) => void;
  @prop declare onTrigger: (build: any) => void;
  @prop declare triggerKey: string | null;

  @state downloading = false;
  /** null until asked for: this is one request per row, and most rows are never expanded. */
  @state versions: { installed: string | null; built: string | null; available: string[] } | null = null;
  @state versionsOpen = false;
  @state loadingVersions = false;
  @state installing: string | null = null;
  @state versionError = '';
  @state chosenVersion = '';
  /** Mirrors the source's own setting so the toggle reflects a save without refetching the list. */
  @state autoUpdating: boolean | null = null;
  @state savingAutoUpdate = false;

  /** This row's identity. A slug alone matches the plugin AND the theme that share it. */
  get identityKey(): string {
    return `${String(this.build?.type ?? '')}/${String(this.build?.slug ?? '')}`;
  }

  /**
   * Fetches the package through the authenticated client and hands the browser the bytes.
   *
   * The archive is made when it is asked for, so this can take a moment on the first press — the
   * button says so rather than appearing to do nothing.
   */
  @bound
  async download(): Promise<void> {
    if (!Platform.hasWindow || this.downloading) return;
    this.downloading = true;
    try {
      const { blob, filename } = await SourcesApi.downloadPackage(String(this.build.type ?? ''), this.build.slug);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    } finally {
      this.downloading = false;
    }
  }

  /**
   * Opens the version list, fetching it the first time.
   *
   * Not part of the polled list payload: it reads the staging directory of every source on the box,
   * and the list refreshes on a timer. One row, when asked.
   */
  @bound
  async toggleVersions(): Promise<void> {
    this.versionsOpen = !this.versionsOpen;
    if (!this.versionsOpen || this.versions || this.loadingVersions) return;

    this.loadingVersions = true;
    this.versionError = '';
    try {
      await this.loadVersions();
    } finally {
      this.loadingVersions = false;
    }
  }

  /** Puts the chosen version in place, then shows what is installed now rather than assuming. */
  @bound
  async installChosen(): Promise<void> {
    const version = this.chosenVersion;
    if (!version || this.installing) return;

    this.installing = version;
    this.versionError = '';
    try {
      const answer = await SourcesApi.installVersion(String(this.build.type ?? ''), this.build.slug, version);
      this.versions = {
        installed: answer?.installed ?? null,
        built: answer?.built ?? null,
        available: Array.isArray(answer?.available) ? answer.available : (this.versions?.available ?? []),
      };
    } catch (err: any) {
      this.versionError = String(err?.message || 'Could not install that version.');
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
  private async loadVersions(): Promise<void> {
    try {
      const answer = await SourcesApi.versions(String(this.build.type ?? ''), this.build.slug);
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
      await SourcesApi.update(String(this.build.type ?? ''), this.build.slug, next
        ? { autoUpdate: true, installAfterBuild: true }
        : { autoUpdate: false });
      this.autoUpdating = next;
    } catch (err: any) {
      this.versionError = String(err?.message || 'Could not change automatic updating.');
    } finally {
      this.savingAutoUpdate = false;
    }
  }

  /** The source's setting, or the local override once it has been changed here. */
  get autoUpdateEnabled(): boolean {
    return this.autoUpdating ?? Boolean(this.build?.autoUpdate);
  }

  /**
   * What this source has produced, in the terms the operator asked for it.
   *
   * It used to read the ARCHIVE's filename and say "waiting for first successful build" when there
   * was none — which became a lie the moment a build stopped writing an archive: the build had
   * succeeded, and the screen said it had not happened. The package is the thing; the zip is a
   * download somebody may never ask for.
   */
  get packageLabel(): string {
    if (this.build.fileName) return `Archive: ${this.build.fileName}`;
    const version = String(this.build.version || '').trim();
    if (version && this.build.lastBuildStatus === 'success') {
      return `Package: ${this.build.slug} ${version} — built and ready`;
    }
    return 'Package: waiting for first successful build';
  }

  render(): ReactNode {
    // Offered for any source that has built something. Gated on the VERSION, not on a filename:
    // a build stages a package directory and writes no archive, so gating on a file meant the
    // button appeared only after somebody had already downloaded one.
    const canDownload = Boolean(String(this.build.version || '').trim())
      && this.build.lastBuildStatus === 'success';
    const tokenLabel = this.build.hasGitSecret
      ? 'Per-source token stored'
      : (this.build.usesEnvToken ? 'Using app-level GITHUB_TOKEN' : 'No token configured');
    const repositoryLabel = String(this.build.gitUrl || '').trim();

    // The repository, without the ceremony. Every row said the same 30 characters of
    // `https://github.com/fromcode119/` before the part that differs.
    const repositoryShort = repositoryLabel.replace(/^https?:\/\/(www\.)?/, '').replace(/\.git$/, '');

    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <GitBranch size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {/*
                * ONE line of identity, not five. Twenty sources at 132px each was 2,678px of list in
                * an 822px window — the screen could not show you what you had. Everything below is
                * still here; the facts that repeat on every row (the github.com prefix, the token
                * wording, "builds automatically") stopped taking a line each.
                */}
              <div className="flex min-w-0 items-baseline gap-2">
                <h4 className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">{this.build.slug}</h4>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">{this.build.type}</span>
                <span className="truncate text-[11px] text-slate-500 dark:text-slate-400" title={this.packageLabel}>
                  {this.build.branch || 'main'}
                  {this.build.version ? ` · v${this.build.version}` : ' · no build yet'}
                  {this.build.autoBuild ? ' · auto' : ''}
                </span>
              </div>
              <p className="truncate text-[11px] text-slate-400" title={`${repositoryLabel}\n${tokenLabel}`}>
                {repositoryShort}
              </p>
              <BuildChangelog changelog={this.build.changelog} version={this.build.version} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BuildStatusBadge status={this.build.lastBuildStatus} />
              {canDownload ? (
                <Button
                  onClick={this.download}
                  disabled={this.downloading}
                  icon={<Download size={12} />}
                  variant={ButtonVariant.GHOST}
                >
                  {this.downloading ? 'Packaging…' : 'Package'}
                </Button>
              ) : null}
              <Button
                icon={<History size={12} />}
                onClick={this.toggleVersions}
                variant={ButtonVariant.GHOST}
              >
                Versions
              </Button>
              <Button
                icon={<Play size={12} className={this.triggerKey === this.identityKey ? 'animate-spin' : ''} />}
                onClick={() => this.onTrigger(this.build)}
                disabled={this.triggerKey === this.identityKey || this.deletingKey === this.identityKey}
                variant={ButtonVariant.OUTLINE}
              >
                {this.triggerKey === this.identityKey ? 'Building' : 'Build'}
              </Button>
              <Button icon={<Pencil size={12} />} onClick={() => this.onEdit(this.build)} variant={ButtonVariant.GHOST}>
                Edit
              </Button>
              <Button
                className="text-slate-400 hover:text-rose-600"
                disabled={this.deletingKey === this.identityKey}
                icon={<Trash2 size={12} className={this.deletingKey === this.identityKey ? 'animate-spin' : ''} />}
                onClick={() => this.onDelete(this.build)}
                variant={ButtonVariant.GHOST}
              >
                Remove
              </Button>
            </div>
          </div>
          {this.versionsOpen ? (
            <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] dark:border-slate-800 dark:bg-slate-900/40">
              {this.loadingVersions ? (
                <span className="text-slate-500">Reading versions…</span>
              ) : (
                <div className="flex flex-col gap-2">
                  {/*
                    * INSTALLED and BUILT side by side, because they are different facts from
                    * different places and the row above can only say one of them. When they differ,
                    * that difference is the thing the operator came to find out.
                    */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-slate-500 dark:text-slate-400">
                      Installed:{' '}
                      <strong className="font-semibold text-slate-900 dark:text-white">
                        {this.versions?.installed ? `v${this.versions.installed}` : 'not installed'}
                      </strong>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Last built:{' '}
                      <strong className="font-semibold text-slate-900 dark:text-white">
                        {this.versions?.built ? `v${this.versions.built}` : 'never'}
                      </strong>
                    </span>
                    {this.versions?.installed && this.versions?.built && this.versions.installed !== this.versions.built ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600">
                        built version is not the one running
                      </span>
                    ) : null}
                  </div>

                  {/*
                    * Keeping this source current, offered where an operator asks the question. The same
                    * field is in Edit as the second half of a pair called "Update if already installed";
                    * this is the screen about versions, so it is offered here too and writes the same
                    * setting. Turning it ON also sets "Install after build", because the installer is
                    * only reached inside that branch.
                    */}
                  <Switch
                    checked={this.autoUpdateEnabled}
                    onChange={this.toggleAutoUpdate}
                    disabled={this.savingAutoUpdate}
                    label="Update automatically"
                    description="Replace the running version whenever a new one is built from this repository."
                  />

                  {this.versions && this.versions.available.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-slate-500 dark:text-slate-400">Install version</label>
                      {/*
                        * The admin's own Select, not a bare `<select>`. A native one renders in the
                        * operating system's styling — its own font, its own blue highlight, its own
                        * menu — beside fields that use this console's, which is what it looked like.
                        */}
                      <Select
                        value={this.chosenVersion}
                        options={this.versions.available.map((version) => ({
                          value: version,
                          label: `v${version}${version === this.versions?.installed ? ' — installed' : ''}`,
                        }))}
                        onChange={(value: string) => { this.chosenVersion = value; }}
                        size={FieldSize.SM}
                        className="w-44"
                      />
                      {/*
                        * Disabled only while an install is running. It used to also be disabled when the
                        * chosen version matched the installed one, which reads as sensible and is wrong
                        * in the one case that matters: after a failed install the panel can still name
                        * the old version as installed, and that is precisely when reinstalling it is the
                        * way back. Reinstalling a version already in place is harmless.
                        */}
                      <Button
                        onClick={this.installChosen}
                        disabled={Boolean(this.installing) || !this.chosenVersion}
                        variant={ButtonVariant.OUTLINE}
                      >
                        {this.installing ? `Installing v${this.installing}…` : 'Install'}
                      </Button>
                      <span className="text-slate-400">
                        Every version this installation still has staged. Installing an older one replaces the running code; it does not activate a theme.
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400">
                      No packages are staged for this source yet — build it once and its versions appear here.
                    </span>
                  )}

                  {this.versionError ? (
                    <span className="text-rose-600 dark:text-rose-400">{this.versionError}</span>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
          {this.build.lastBuildStatus === 'failed' && this.build.lastError ? (
            <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
              {this.build.lastError}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}
