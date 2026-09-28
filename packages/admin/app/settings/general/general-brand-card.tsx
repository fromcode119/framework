import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/general/setting-row';
import { DomainAliasesInput } from '@/app/settings/general/components/view/domain-aliases-input.client';
import { AdminClass } from '@/lib/admin-class';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { Explanation } from '@/components/ui/view/explanation.client';
import { FrameworkReleaseDefaults } from '@fromcode119/core/client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';
import { MediaRelationField } from '@/components/collection/view/media-relation-field.client';

export class GeneralBrandCard extends PureReactor {
  /**
   * The settings on this card that belong to the PLATFORM, not to the site being administered.
   *
   * A site administrator may READ a deployment truth like the admin or marketplace URL — several
   * screens need it — but a save is refused by the API, so it is rendered as a value with its owner
   * named rather than as an input that fails when pressed.
   */
  @prop declare platformLocks: PlatformSettingLocks;
  @prop declare settings: Record<string, any>;
  @prop declare setSettings: Dispatch<SetStateAction<Record<string, any>>>;
  @prop declare theme: ThemeMode;
  @prop declare toggleTheme: () => void;

  private shown(key: string): boolean {
    return this.platformLocks.shown(key);
  }

  private patchSetting(key: string, value: unknown): void {
    this.setSettings(prev => ({ ...prev, [key]: value }));
  }

  @bound
  protected onPlatformNameChange(e: ChangeEvent<HTMLInputElement>): void {
    this.patchSetting('platform_name', e.target.value);
  }

  /** The media picker hands back an id; the setting stores it as text, blank for none. */
  @bound
  protected onEmailLogoChange(value: unknown): void {
    this.patchSetting('email_logo', value ? String(value) : '');
  }

  @bound
  protected onFrontendUrlChange(e: ChangeEvent<HTMLInputElement>): void {
    this.patchSetting('frontend_url', e.target.value);
  }

  @bound
  protected onAdminUrlChange(e: ChangeEvent<HTMLInputElement>): void {
    this.patchSetting('admin_url', e.target.value);
  }

  @bound
  protected onSiteUrlChange(e: ChangeEvent<HTMLInputElement>): void {
    this.patchSetting('site_url', e.target.value);
  }

  @bound
  protected onMarketplaceUrlChange(e: ChangeEvent<HTMLInputElement>): void {
    this.patchSetting('marketplace_url', e.target.value);
  }

  @bound
  onFrameworkRepositoryChange(e: React.ChangeEvent<HTMLInputElement>): void {
    this.patchSetting('framework_repository', e.target.value);
  }

  @bound
  onSourcesWorkspaceRootChange(e: React.ChangeEvent<HTMLInputElement>): void {
    this.patchSetting('sources_workspace_root', e.target.value);
  }

  @bound
  protected onDomainAliasesChange(aliases: string[]): void {
    this.patchSetting('domain_aliases', aliases);
  }

  @bound
  protected selectLight(): void {
    if (this.theme === ThemeMode.DARK) this.toggleTheme();
  }

  @bound
  protected selectDark(): void {
    if (this.theme === ThemeMode.LIGHT) this.toggleTheme();
  }

  private get domainAliases(): string[] {
    return Array.isArray(this.settings.domain_aliases) ? this.settings.domain_aliases : [];
  }

  render(): ReactNode {
    const theme = this.theme;
    const settings = this.settings;
    return (
      <Card title={AdminI18n.t('settings.general.brandIdentity')}>
        {this.shown('platform_name') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Zap}
            title={AdminI18n.t('settings.general.platformName')}
            description={AdminI18n.t('settings.general.thePublicIdentifierForYour')}
          >
            <Input
              value={settings.platform_name}
              onChange={this.onPlatformNameChange}
              className="w-full md:w-64 font-bold"
              placeholder={AdminI18n.t('settings.general.eGMyWebsite')}
            />
          </SettingRow>
        )}

        {this.shown('email_logo') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Mail}
            title={AdminI18n.t('settings.general.emailLogo')}
            description={AdminI18n.t('settings.general.emailLogoDescription')}
            stacked
          >
            <MediaRelationField value={settings.email_logo || ''} onChange={this.onEmailLogoChange} theme={theme} />
          </SettingRow>
        )}

        {this.shown('frontend_url') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Globe}
            title={AdminI18n.t('settings.general.frontendUrl')}
            description={AdminI18n.t('settings.general.thisDeploymentSOwnFrontend')}
            explanation={(
              <Explanation>
                <p>
                  {AdminI18n.t('settings.general.itIsAlsoTheBase')}
                </p>
                <p><AdminRichText k="settings.general.frontendUrlMultiSite" /></p>
              </Explanation>
            )}
          >
            <Input
              value={settings.frontend_url}
              onChange={this.onFrontendUrlChange}
              className="w-full md:w-64 font-bold"
              placeholder="https://example.com"
            />
          </SettingRow>
        )}

        {this.shown('admin_url') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Globe}
            title={AdminI18n.t('settings.general.adminUrl')}
            description={AdminI18n.t('settings.general.thisDeploymentSAdminConsole')}
            explanation={(
              <Explanation>
                <p>
                  {AdminI18n.t('settings.general.usedByTheGatewayAnd')}
                </p>
                <p><AdminRichText k="settings.general.adminUrlFallback" /></p>
              </Explanation>
            )}
          >
            <Input
              value={settings.admin_url}
              onChange={this.onAdminUrlChange}
              className="w-full md:w-64 font-bold"
              placeholder="https://admin.example.com"
            />
          </SettingRow>
        )}

        {this.shown('site_url') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Globe}
            title={AdminI18n.t('settings.general.siteUrl')}
            description={AdminI18n.t('settings.general.aFallbackForFrontendUrl')}
            explanation={(
              <Explanation>
                <p>
                  {AdminI18n.t('settings.general.usedOnlyWhenFrontendUrl')}
                </p>
                <p><AdminRichText k="settings.general.siteUrlMultiSite" /></p>
              </Explanation>
            )}
          >
            <Input
              value={settings.site_url}
              onChange={this.onSiteUrlChange}
              className="w-full md:w-64 font-bold"
              placeholder="https://example.com"
            />
          </SettingRow>
        )}

        {this.shown('marketplace_url') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Globe}
            title={AdminI18n.t('settings.general.marketplaceUrl')}
            description={this.platformLocks.isSiteScope()
              ? <AdminRichText k="settings.general.marketplaceUrlSite" />
              : <AdminRichText k="settings.general.marketplaceUrlPlatform" />}
          >
            <Input
              value={settings.marketplace_url}
              onChange={this.onMarketplaceUrlChange}
              className="w-full md:w-64 font-bold"
              placeholder="https://marketplace.example.com"
            />
          </SettingRow>
        )}

        {this.shown('framework_repository') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Package}
            title={AdminI18n.t('settings.general.frameworkRepository')}
            description={<AdminRichText k="settings.general.frameworkRepositoryDescription" vars={{ repository: FrameworkReleaseDefaults.REPOSITORY }} />}
          >
            <Input
              value={settings.framework_repository}
              onChange={this.onFrameworkRepositoryChange}
              className="w-full md:w-64 font-bold"
              placeholder={FrameworkReleaseDefaults.REPOSITORY}
            />
          </SettingRow>
        )}

        {this.shown('sources_workspace_root') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Folder}
            title={AdminI18n.t('settings.general.sourcesWorkspace')}
            description={<AdminRichText k="settings.general.sourcesWorkspaceDescription" />}
          >
            <Input
              value={settings.sources_workspace_root}
              onChange={this.onSourcesWorkspaceRootChange}
              className="w-full md:w-64 font-bold"
              placeholder="data/sources"
            />
          </SettingRow>
        )}

        {this.shown('domain_aliases') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Globe}
            title={AdminI18n.t('settings.general.domainAliases')}
            description={AdminI18n.t('settings.general.additionalHostnamesThatServeYour')}
          >
            <DomainAliasesInput
              value={this.domainAliases}
              onChange={this.onDomainAliasesChange}
              theme={theme}
            />
          </SettingRow>
        )}

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Palette}
          title={AdminI18n.t('settings.general.visualCore')}
          description={AdminI18n.t('settings.general.chooseTheVisualStyleOf')}
        >
          <div className={`flex p-1 ${AdminClass.SURFACE} ${theme === ThemeMode.DARK ? 'bg-slate-900 border border-slate-800 shadow-inner' : 'bg-slate-100/80 border border-slate-100 shadow-inner'}`}>
            <button onClick={this.selectLight} className={`flex items-center gap-2 px-6 py-2 text-[10px] font-bold uppercase tracking-tight ${AdminClass.SURFACE} transition-all ${theme === ThemeMode.LIGHT ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-300'}`}>
              <FrameworkIcons.Sun size={14} /> {AdminI18n.t('settings.general.light')}
            </button>
            <button onClick={this.selectDark} className={`flex items-center gap-2 px-6 py-2 text-[10px] font-bold uppercase tracking-tight rounded-xl transition-all ${theme === ThemeMode.DARK ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-indigo-600'}`}>
              <FrameworkIcons.Moon size={14} /> {AdminI18n.t('settings.general.dark')}
            </button>
          </div>
        </SettingRow>
      </Card>
    );
  }
}
