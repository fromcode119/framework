import type { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Input } from '@/components/ui/view/input.client';
import { Switch } from '@/components/ui/view/switch.client';
import { SettingRow } from '@/app/settings/general/setting-row';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';

/**
 * The platform's Sources settings: where builds are made, how many built versions of each extension
 * stay on disk, and whether a commit GitHub did not merge may be built. Each row shows only where the
 * platform lets this administrator see it.
 */
export class GeneralSourcesRows extends PureReactor {
  @prop declare platformLocks: PlatformSettingLocks;
  @prop declare settings: Record<string, any>;
  @prop declare setSettings: Dispatch<SetStateAction<Record<string, any>>>;
  @prop declare theme: ThemeMode;

  private patchSetting(key: string, value: unknown): void {
    this.setSettings((prev) => ({ ...prev, [key]: value }));
  }

  @bound
  protected onWorkspaceRootChange(e: ChangeEvent<HTMLInputElement>): void {
    this.patchSetting('sources_workspace_root', e.target.value);
  }

  @bound
  protected onKeepBuildsChange(e: ChangeEvent<HTMLInputElement>): void {
    this.patchSetting('sources_keep_builds', e.target.value);
  }

  @bound
  protected onBuildUnverifiedChange(value: boolean): void {
    this.patchSetting('sources_build_unverified_commits', value);
  }

  render(): ReactNode {
    const { settings, theme, platformLocks } = this;
    return (
      <>
        {platformLocks.shown('sources_workspace_root') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Folder}
            title={AdminI18n.t('settings.general.sourcesWorkspace')}
            description={<AdminRichText k="settings.general.sourcesWorkspaceDescription" />}
          >
            <Input value={settings.sources_workspace_root} onChange={this.onWorkspaceRootChange} className="w-full md:w-64 font-bold" placeholder="data/sources" />
          </SettingRow>
        )}

        {platformLocks.shown('sources_keep_builds') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Folder}
            title={AdminI18n.t('settings.general.sourcesKeepBuilds')}
            description={AdminI18n.t('settings.general.sourcesKeepBuildsDescription')}
          >
            <Input type="number" min={1} step={1} value={settings.sources_keep_builds} onChange={this.onKeepBuildsChange} className="w-full md:w-24 font-bold" />
          </SettingRow>
        )}

        {platformLocks.shown('sources_build_unverified_commits') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.ShieldAlert}
            title={AdminI18n.t('settings.general.sourcesBuildUnverified')}
            description={AdminI18n.t('settings.general.sourcesBuildUnverifiedDescription')}
          >
            <Switch checked={settings.sources_build_unverified_commits === true} onChange={this.onBuildUnverifiedChange} />
          </SettingRow>
        )}
      </>
    );
  }
}
