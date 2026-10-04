import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/view/button.client';
import { Select } from '@/components/ui/view/select.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { Download, GitBranch, History, Pencil, Play, Trash2 } from 'lucide-react';
import { BuildStatusBadge } from '@/app/sources/build-status-badge';
import { BuildChangelog } from '@/app/sources/build-changelog';
import { BuildSourceListItemActions } from '@/app/sources/build-source-list-item-actions';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One source in the Sources list.
 *
 * The top of the chain: the markup. What the row knows and what it can do live in the links below —
 * see `BuildSourceListItemState`.
 */
export class BuildSourceListItem extends BuildSourceListItemActions {
  render(): ReactNode {
    // Offered for any source that has built something. Gated on the VERSION, not on a filename:
    // a build stages a package directory and writes no archive, so gating on a file meant the
    // button appeared only after somebody had already downloaded one.
    const canDownload = Boolean(String(this.build.version || '').trim())
      && this.build.lastBuildStatus === 'success';
    const tokenLabel = this.build.hasGitSecret
      ? AdminI18n.t('sources.perSourceTokenStored')
      : (this.build.usesEnvToken ? AdminI18n.t('sources.usingAppLevelGithubToken') : AdminI18n.t('sources.noTokenConfigured'));
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
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              {/*
                * ONE line of identity, not five. Twenty sources at 132px each was 2,678px of list in
                * an 822px window — the screen could not show you what you had. Everything below is
                * still here; the facts that repeat on every row (the github.com prefix, the token
                * wording, "builds automatically") stopped taking a line each.
                */}
              <div className="flex min-w-0 items-baseline gap-2">
                <h4 className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">{this.build.slug}</h4>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-400">{this.build.type}</span>
                <span className="shrink-0 text-[11px] text-slate-600 dark:text-slate-400" title={AdminI18n.t('sources.vendorHelp')}>
                  {this.vendorLabel}
                </span>
                <span className="truncate text-[11px] text-slate-600 dark:text-slate-400" title={this.packageLabel}>
                  {this.build.branch || 'main'}
                  {this.build.version ? ` · v${this.build.version}` : AdminI18n.t('sources.noBuildYet')}
                  {this.build.autoBuild ? ` · ${AdminI18n.t('sources.auto')}` : ''}
                </span>
              </div>
              <p className="truncate text-[11px] text-slate-600 dark:text-slate-400" title={`${repositoryLabel}\n${tokenLabel}`}>
                {repositoryShort}
              </p>
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
                  {this.downloading ? AdminI18n.t('sources.packaging') : AdminI18n.t('sources.package')}
                </Button>
              ) : null}
              <Button
                icon={<History size={12} />}
                onClick={this.toggleVersions}
                variant={ButtonVariant.GHOST}
              >
                {AdminI18n.t('sources.versions')}
              </Button>
              <Button
                icon={<Play size={12} className={this.triggerKey === this.identityKey ? 'animate-spin' : ''} />}
                onClick={() => this.onTrigger(this.build)}
                disabled={this.triggerKey === this.identityKey || this.deletingKey === this.identityKey}
                variant={ButtonVariant.OUTLINE}
              >
                {this.triggerKey === this.identityKey ? AdminI18n.t('sources.building') : AdminI18n.t('sources.build')}
              </Button>
              <Button icon={<Pencil size={12} />} onClick={() => this.onEdit(this.build)} variant={ButtonVariant.GHOST}>
                {AdminI18n.t('sources.edit')}
              </Button>
              <Button
                className="text-slate-600 hover:text-rose-600 dark:text-slate-400"
                disabled={this.deletingKey === this.identityKey}
                icon={<Trash2 size={12} className={this.deletingKey === this.identityKey ? 'animate-spin' : ''} />}
                onClick={() => this.onDelete(this.build)}
                variant={ButtonVariant.GHOST}
              >
                {AdminI18n.t('sources.remove')}
              </Button>
            </div>
          </div>
          <BuildChangelog changelog={this.build.changelog} version={this.build.version} />
          {this.versionsOpen ? (
            <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] dark:border-slate-800 dark:bg-slate-900/40">
              {this.loadingVersions ? (
                <span className="text-slate-500">{AdminI18n.t('sources.readingVersions')}</span>
              ) : (
                <div className="flex flex-col gap-2">
                  {/*
                    * INSTALLED and BUILT side by side, because they are different facts from
                    * different places and the row above can only say one of them. When they differ,
                    * that difference is the thing the operator came to find out.
                    */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-slate-500 dark:text-slate-400">
                      {AdminI18n.t('sources.installedLabel')}{' '}
                      <strong className="font-semibold text-slate-900 dark:text-white">
                        {this.versions?.installed ? `v${this.versions.installed}` : AdminI18n.t('sources.notInstalled')}
                      </strong>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {AdminI18n.t('sources.lastBuiltLabel')}{' '}
                      <strong className="font-semibold text-slate-900 dark:text-white">
                        {this.versions?.built ? `v${this.versions.built}` : AdminI18n.t('sources.never')}
                      </strong>
                    </span>
                    {this.versions?.installed && this.versions?.built && this.versions.installed !== this.versions.built ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600">
                        {AdminI18n.t('sources.builtVersionIsNotThe')}
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
                    label={AdminI18n.t('sources.updateAutomatically')}
                    description={AdminI18n.t('sources.replaceTheRunningVersionWhenever')}
                  />

                  {this.versions && this.versions.available.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-slate-500 dark:text-slate-400">{AdminI18n.t('sources.installVersion')}</label>
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
                        {this.installing ? AdminI18n.t('sources.installingV', { installing: this.installing }) : AdminI18n.t('sources.install')}
                      </Button>
                      <span className="text-slate-600 dark:text-slate-400">
                        {AdminI18n.t('sources.everyVersionThisInstallationStill')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-600 dark:text-slate-400">
                      {AdminI18n.t('sources.noPackagesAreStagedFor')}
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
          {/* Where builds are handed, and what happened last time — the operator sees the hand-over
              without opening the target site. */}
          {this.build.publishToSite ? (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {AdminI18n.t('sources.publishesTo', { site: this.build.publishToSite })}
              {this.build.lastPublish ? <span className="block">{this.build.lastPublish}</span> : <span className="block">{AdminI18n.t('sources.notPublishedYet')}</span>}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}
