import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Switch } from '@/components/ui/view/switch.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Three switches for three different acts, none of them implying another. Building produces a
 * package; installing one that is not there yet is additive; REPLACING code that is serving a site
 * is not, and needs its own yes.
 */
export class BuildSourceSwitches extends PureReactor {
  declare props: Pick<BuildSourceSwitches, 'autoBuild' | 'installAfterBuild' | 'autoUpdate' | 'onAutoBuild' | 'onInstallAfterBuild' | 'onAutoUpdate'>;

  @prop declare autoBuild: boolean;
  @prop declare installAfterBuild: boolean;
  @prop declare autoUpdate: boolean;
  @prop declare onAutoBuild: (checked: boolean) => void;
  @prop declare onInstallAfterBuild: (checked: boolean) => void;
  @prop declare onAutoUpdate: (checked: boolean) => void;

  render(): ReactNode {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
        <Switch checked={this.autoBuild} onChange={this.onAutoBuild} label={AdminI18n.t('sources.buildAutomatically')} description={AdminI18n.t('sources.buildThisSourceWheneverNew')} />
        <Switch checked={this.installAfterBuild} onChange={this.onInstallAfterBuild} label={AdminI18n.t('sources.installAfterBuild')} description={AdminI18n.t('sources.putEachSuccessfulBuildIn')} />
        {/* DEPENDENT on the switch above, because the code is: the installer is only reached inside the
            `installAfterBuild` branch, so this flag is never consulted while that one is off. */}
        <Switch
          checked={this.autoUpdate}
          onChange={this.onAutoUpdate}
          disabled={!this.installAfterBuild}
          label={AdminI18n.t('sources.updateIfAlreadyInstalled')}
          description={this.installAfterBuild ? AdminI18n.t('sources.alsoReplaceTheRunningVersion') : AdminI18n.t('sources.needsInstallAfterBuildAbove')}
        />
      </div>
    );
  }
}
