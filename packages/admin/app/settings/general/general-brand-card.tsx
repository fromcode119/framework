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
import { FrameworkReleaseDefaults } from '@fromcode119/core/client';

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

  private locked(key: string): boolean {
    return this.platformLocks.locks(key);
  }

  /** The field's own description, plus who owns the value when this account cannot change it. */
  private describe(key: string, description: string): ReactNode {
    if (!this.locked(key)) return description;
    return (
      <>
        {description}
        <span className="mt-1 block text-[12px] font-semibold text-slate-400">
          Platform setting — the same for every site, and only a platform admin can change it.
        </span>
      </>
    );
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
      <Card title="Brand & Identity">
        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Zap}
          title="Platform Name"
          description="The public identifier for your portal and administrative interface."
        >
          <Input
            value={settings.platform_name}
            onChange={this.onPlatformNameChange}
            className="w-full md:w-64 font-bold"
            placeholder="e.g. My Website"
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Globe}
          title="Frontend URL"
          description={this.describe('frontend_url', "The base URL where your website is hosted. Used for previews and sitemaps.")}
        >
          <Input
            value={settings.frontend_url}
            onChange={this.onFrontendUrlChange}
            disabled={this.locked('frontend_url')}
            className="w-full md:w-64 font-bold"
            placeholder="https://example.com"
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Globe}
          title="Admin URL"
          description={this.describe('admin_url', "The web address of your admin panel (e.g. https://admin.yoursite.com). Used for admin links and sign-in redirects. Leave blank to use the server's configured default.")}
        >
          <Input
            value={settings.admin_url}
            onChange={this.onAdminUrlChange}
            disabled={this.locked('admin_url')}
            className="w-full md:w-64 font-bold"
            placeholder="https://admin.example.com"
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Globe}
          title="Site URL"
          description={this.describe('site_url', "Your main public website address. Used as a fallback for links in emails, sitemaps, and feeds. Leave blank to use the server's configured default.")}
        >
          <Input
            value={settings.site_url}
            onChange={this.onSiteUrlChange}
            disabled={this.locked('site_url')}
            className="w-full md:w-64 font-bold"
            placeholder="https://example.com"
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Globe}
          title="Marketplace URL"
          description={this.describe('marketplace_url', "Where the platform downloads plugin, theme, and core updates from. Leave blank to use the default marketplace, or type 'off' to turn the marketplace off.")}
        >
          <Input
            value={settings.marketplace_url}
            onChange={this.onMarketplaceUrlChange}
            disabled={this.locked('marketplace_url')}
            className="w-full md:w-64 font-bold"
            placeholder="https://marketplace.example.com"
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Package}
          title="Framework Repository"
          description={this.describe('framework_repository', `Checked for new framework releases when no marketplace answers. \`owner/repo\` on GitHub — point it at your own fork if you run one. Blank uses ${FrameworkReleaseDefaults.REPOSITORY}.`)}
        >
          <Input
            value={settings.framework_repository}
            onChange={this.onFrameworkRepositoryChange}
            disabled={this.locked('framework_repository')}
            className="w-full md:w-64 font-bold"
            placeholder={FrameworkReleaseDefaults.REPOSITORY}
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Globe}
          title="Domain Aliases"
          description="Additional hostnames that serve your frontend. Allowed through CORS and used for multi-domain deployments."
        >
          <DomainAliasesInput
            value={this.domainAliases}
            onChange={this.onDomainAliasesChange}
            theme={theme}
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Palette}
          title="Visual Core"
          description="Choose the visual style of your administration panel."
        >
          <div className={`flex p-1 ${AdminClass.SURFACE} ${theme === ThemeMode.DARK ? 'bg-slate-900 border border-slate-800 shadow-inner' : 'bg-slate-100/80 border border-slate-100 shadow-inner'}`}>
            <button onClick={this.selectLight} className={`flex items-center gap-2 px-6 py-2 text-[10px] font-bold uppercase tracking-tight ${AdminClass.SURFACE} transition-all ${theme === ThemeMode.LIGHT ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-300'}`}>
              <FrameworkIcons.Sun size={14} /> Light
            </button>
            <button onClick={this.selectDark} className={`flex items-center gap-2 px-6 py-2 text-[10px] font-bold uppercase tracking-tight rounded-xl transition-all ${theme === ThemeMode.DARK ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-indigo-600'}`}>
              <FrameworkIcons.Moon size={14} /> Dark
            </button>
          </div>
        </SettingRow>
      </Card>
    );
  }
}
