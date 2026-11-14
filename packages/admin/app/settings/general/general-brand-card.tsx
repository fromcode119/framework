import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { DomainAliasesInput } from '@/app/settings/general/components/view/domain-aliases-input.client';
import { AdminClass } from '@/lib/admin-class';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { Explanation } from '@/components/ui/view/explanation.client';
import { FrameworkReleaseDefaults, MarketplaceDefaults } from '@fromcode119/core/client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';
import { GeneralEmailLogoRow } from '@/app/settings/general/general-email-logo-row';
import { GeneralSiteIconRow } from '@/app/settings/general/general-site-icon-row';
import { GeneralSourcesRows } from '@/app/settings/general/general-sources-rows';

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

  @bound
  protected onFrontendUrlChange(e: ChangeEvent<HTMLInputElement>): void {
    this.patchSetting('frontend_url', e.target.value);
  }

  @bound
  protected onAdminUrlChange(e: ChangeEvent<HTMLInputElement>): void {
    this.patchSetting('admin_url', e.target.value);
  }

  @bound
  protected onApiUrlChange(e: ChangeEvent<HTMLInputElement>): void {
    this.patchSetting('api_url', e.target.value);
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
      <Card title={AdminI18n.t('settings.general.brandIdentity')} description={AdminI18n.t('settings.general.brandIdentityCardDescription')}>
        {this.shown('platform_name') && (
          <SettingRow
            theme={theme}
            title={AdminI18n.t('settings.general.platformName')}
            description={AdminI18n.t('settings.general.thePublicIdentifierForYour')}
          >
            <Input
              value={settings.platform_name}
              onChange={this.onPlatformNameChange}
              className="w-full"
              placeholder={AdminI18n.t('settings.general.eGMyWebsite')}
            />
          </SettingRow>
        )}

        {this.shown(GeneralEmailLogoRow.KEY) && (
          <GeneralEmailLogoRow settings={settings} setSettings={this.setSettings} theme={theme} />
        )}

        {this.shown(GeneralSiteIconRow.KEY) && (
          <GeneralSiteIconRow settings={settings} setSettings={this.setSettings} />
        )}

        {this.shown('frontend_url') && (
          <SettingRow
            theme={theme}
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
              className="w-full"
              placeholder="https://example.com"
            />
          </SettingRow>
        )}

        {this.shown('admin_url') && (
          <SettingRow
            theme={theme}
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
              className="w-full"
              placeholder="https://admin.example.com"
            />
          </SettingRow>
        )}

        {this.shown('api_url') && (
          <SettingRow
            theme={theme}
            title={AdminI18n.t('settings.general.apiUrl')}
            description={AdminI18n.t('settings.general.apiUrlDescription')}
            explanation={(
              <Explanation>
                <p>{AdminI18n.t('settings.general.apiUrlExplanation')}</p>
              </Explanation>
            )}
          >
            <Input
              value={settings.api_url}
              onChange={this.onApiUrlChange}
              className="w-full"
              placeholder="https://example.com"
            />
          </SettingRow>
        )}

        {this.shown('site_url') && (
          <SettingRow
            theme={theme}
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
              className="w-full"
              placeholder="https://example.com"
            />
          </SettingRow>
        )}

        {this.shown('marketplace_url') && (
          <SettingRow
            theme={theme}
            title={AdminI18n.t('settings.general.marketplaceUrl')}
            description={this.platformLocks.isSiteScope()
              ? <AdminRichText k="settings.general.marketplaceUrlSite" />
              : <AdminRichText k="settings.general.marketplaceUrlPlatform" vars={{ address: MarketplaceDefaults.ADDRESS }} />}
          >
            <Input
              value={settings.marketplace_url}
              onChange={this.onMarketplaceUrlChange}
              className="w-full"
              placeholder={this.platformLocks.isSiteScope() ? 'https://marketplace.example.com' : MarketplaceDefaults.ADDRESS}
            />
          </SettingRow>
        )}

        {this.shown('framework_repository') && (
          <SettingRow
            theme={theme}
            title={AdminI18n.t('settings.general.frameworkRepository')}
            description={<AdminRichText k="settings.general.frameworkRepositoryDescription" vars={{ repository: FrameworkReleaseDefaults.REPOSITORY }} />}
          >
            <Input
              value={settings.framework_repository}
              onChange={this.onFrameworkRepositoryChange}
              className="w-full"
              placeholder={FrameworkReleaseDefaults.REPOSITORY}
            />
          </SettingRow>
        )}

        <GeneralSourcesRows platformLocks={this.platformLocks} settings={settings} setSettings={this.setSettings} theme={theme} />

        {this.shown('domain_aliases') && (
          <SettingRow
            theme={theme}
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
          title={AdminI18n.t('settings.general.visualCore')}
          description={AdminI18n.t('settings.general.chooseTheVisualStyleOf')}
          width={SettingRowWidth.AUTO}
        >
          {/* The same two-way switch as a section's page tabs. */}
          <div className={AdminClass.of('page-tabs')} role="group">
            <button type="button" onClick={this.selectLight} aria-pressed={theme === ThemeMode.LIGHT} className={AdminClass.of('page-tabs__tab')}>
              {AdminI18n.t('settings.general.light')}
            </button>
            <button type="button" onClick={this.selectDark} aria-pressed={theme === ThemeMode.DARK} className={AdminClass.of('page-tabs__tab')}>
              {AdminI18n.t('settings.general.dark')}
            </button>
          </div>
        </SettingRow>
      </Card>
    );
  }
}
