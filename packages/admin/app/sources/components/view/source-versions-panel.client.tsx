import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/view/button.client';
import { Select } from '@/components/ui/view/select.client';
import { Switch } from '@/components/ui/view/switch.client';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { SourceVersionsActions } from '@/app/sources/components/view/source-versions-actions.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The version panel inside an opened Sources row: installed against built, automatic updating, and
 * installing a chosen version. The top of the chain — see `SourceVersionsState`.
 */
export class SourceVersionsPanel extends SourceVersionsActions {
  private get versionOptions(): { value: string; label: string }[] {
    return (this.versions?.available ?? []).map((version) => ({
      value: version,
      label: `v${version}${version === this.versions?.installed ? ` (${AdminI18n.t('sources.installedMarker')})` : ''}`,
    }));
  }

  private renderFacts(): ReactNode {
    return (
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
        {this.versionsDiffer ? (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600">
            {AdminI18n.t('sources.builtVersionIsNotThe')}
          </span>
        ) : null}
      </div>
    );
  }

  /**
   * Disabled only while an install runs. Reinstalling the version already in place is harmless, and
   * after a failed install it is precisely the way back.
   */
  private renderInstall(): ReactNode {
    if (!this.versions?.available.length) {
      return <span className="text-slate-600 dark:text-slate-400">{AdminI18n.t('sources.noPackagesAreStagedFor')}</span>;
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-slate-500 dark:text-slate-400">{AdminI18n.t('sources.installVersion')}</label>
        <Select value={this.chosenVersion} options={this.versionOptions} onChange={this.chooseVersion} size={FieldSize.SM} className="w-44" />
        <Button onClick={this.installChosen} disabled={Boolean(this.installing) || !this.chosenVersion} variant={ButtonVariant.OUTLINE}>
          {this.installing ? AdminI18n.t('sources.installingV', { installing: this.installing }) : AdminI18n.t('sources.install')}
        </Button>
        <span className="text-slate-600 dark:text-slate-400">{AdminI18n.t('sources.everyVersionThisInstallationStill')}</span>
      </div>
    );
  }

  render(): ReactNode {
    if (this.loadingVersions) return <span className="text-[12px] text-slate-500">{AdminI18n.t('sources.readingVersions')}</span>;
    return (
      <div className="flex flex-col gap-2 text-[12px]">
        {this.renderFacts()}
        {/* The same setting as Edit's "Update if already installed", offered where an operator asks
            "keep this current". Turning it ON also sets "Install after build", which it depends on. */}
        <Switch
          checked={this.autoUpdateEnabled}
          onChange={this.toggleAutoUpdate}
          disabled={this.savingAutoUpdate}
          label={AdminI18n.t('sources.updateAutomatically')}
          description={AdminI18n.t('sources.replaceTheRunningVersionWhenever')}
        />
        {this.renderInstall()}
        {this.versionError ? <span className="text-rose-600 dark:text-rose-400">{this.versionError}</span> : null}
      </div>
    );
  }
}
