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
      <Card title="Brand & Identity">
        {this.shown('platform_name') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Zap}
            title="Platform Name"
            description={'The public identifier for your portal and administrative interface.'}
          >
            <Input
              value={settings.platform_name}
              onChange={this.onPlatformNameChange}
              className="w-full md:w-64 font-bold"
              placeholder="e.g. My Website"
            />
          </SettingRow>
        )}

        {this.shown('frontend_url') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Globe}
            title="Frontend URL"
            description={"This deployment's own frontend address — used by the gateway and for its certificate."}
            explanation={(
              <Explanation>
                <p>
                  It is also the base for sitemaps, sign-in and password-reset emails, plugin links and the
                  admin&rsquo;s &ldquo;view on site&rdquo; links.
                </p>
                <p>
                  <strong>On a multi-site platform, leave it blank.</strong> A value here is read before the
                  request is, so it replaces <em>every</em> site&rsquo;s own domain everywhere in that list.
                  Blank falls back to <code>FRONTEND_URL</code> in the environment, then to the host that made
                  the request — which is how each site gets its own address.
                </p>
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
            title="Admin URL"
            description={"This deployment's admin console address — one console serves every site."}
            explanation={(
              <Explanation>
                <p>
                  Used by the gateway and for the console&rsquo;s certificate, by the setup gate, and as the
                  base for admin password-reset links.
                </p>
                <p>
                  Blank falls back to <code>ADMIN_URL</code> in the environment, then to the host that made the
                  request. Unlike the two above, this one is the platform&rsquo;s however many sites it serves.
                </p>
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
            title="Site URL"
            description="A fallback for Frontend URL — it has no readers of its own."
            explanation={(
              <Explanation>
                <p>
                  Used only when Frontend URL above is blank, and then it means exactly the same thing. It is
                  also allowed through CORS.
                </p>
                <p><strong>On a multi-site platform, leave it blank</strong>, for the same reason as Frontend URL.</p>
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
            title="Marketplace URL"
            description={this.platformLocks.isSiteScope()
              ? <>Where THIS site browses for plugins and themes. Blank uses the platform&apos;s marketplace; <code>off</code> turns this site&apos;s marketplace off. A catalogue that cannot be reached shows an empty marketplace rather than an error.</>
              : <>Where the platform browses for plugins, themes and appearances, and checks for updates, and what every site that has not set its own uses. Blank uses the default marketplace; <code>off</code> turns the marketplace off.</>}
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
            title="Framework Repository"
            description={<>Checked for new framework releases when no marketplace answers. <code>owner/repo</code> on GitHub — point it at your own fork if you run one. Blank uses <code>{FrameworkReleaseDefaults.REPOSITORY}</code>.</>}
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
            title="Sources Workspace"
            description={<>Where Sources clones repositories and writes the packages it builds. Blank uses <code>data/sources</code> beside the platform. Never point it at the plugins or themes directories — that is where the sources being built are mounted from.</>}
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
            title="Domain Aliases"
            description={'Additional hostnames that serve your frontend. Allowed through CORS and used for multi-domain deployments.'}
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
