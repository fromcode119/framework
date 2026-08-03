import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from '@/app/settings/general/setting-row';
import { DomainAliasesInput } from '@/app/settings/general/components/view/domain-aliases-input.client';
import { AdminClass } from '@/lib/admin-class';

export class GeneralBrandCard extends PureReactor {
  @prop declare settings: Record<string, any>;
  @prop declare setSettings: Dispatch<SetStateAction<Record<string, any>>>;
  @prop declare theme: ThemeMode;
  @prop declare toggleTheme: () => void;

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
          description="The base URL where your website is hosted. Used for previews and sitemaps."
        >
          <Input
            value={settings.frontend_url}
            onChange={this.onFrontendUrlChange}
            className="w-full md:w-64 font-bold"
            placeholder="https://example.com"
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Globe}
          title="Admin URL"
          description="The web address of your admin panel (e.g. https://admin.yoursite.com). Used for admin links and sign-in redirects. Leave blank to use the server's configured default."
        >
          <Input
            value={settings.admin_url}
            onChange={this.onAdminUrlChange}
            className="w-full md:w-64 font-bold"
            placeholder="https://admin.example.com"
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Globe}
          title="Site URL"
          description="Your main public website address. Used as a fallback for links in emails, sitemaps, and feeds. Leave blank to use the server's configured default."
        >
          <Input
            value={settings.site_url}
            onChange={this.onSiteUrlChange}
            className="w-full md:w-64 font-bold"
            placeholder="https://example.com"
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Globe}
          title="Marketplace URL"
          description="Where the platform downloads plugin, theme, and core updates from. Leave blank to use the default marketplace, or type 'off' to turn the marketplace off."
        >
          <Input
            value={settings.marketplace_url}
            onChange={this.onMarketplaceUrlChange}
            className="w-full md:w-64 font-bold"
            placeholder="https://marketplace.example.com"
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
