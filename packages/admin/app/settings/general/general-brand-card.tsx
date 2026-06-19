import React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FrameworkIcons } from '@fromcode119/react';
import { SettingRow } from './setting-row';
import { DomainAliasesInput } from './domain-aliases-input';
import type { GeneralBrandCardProps } from './general-brand-card.interfaces';

export class GeneralBrandCard extends React.Component<GeneralBrandCardProps> {
  render(): React.ReactNode {
    const { settings, setSettings, theme, toggleTheme } = this.props;
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
            onChange={(e) => setSettings(prev => ({ ...prev, platform_name: e.target.value }))}
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
            onChange={(e) => setSettings(prev => ({ ...prev, frontend_url: e.target.value }))}
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
            onChange={(e) => setSettings(prev => ({ ...prev, admin_url: e.target.value }))}
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
            onChange={(e) => setSettings(prev => ({ ...prev, site_url: e.target.value }))}
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
            onChange={(e) => setSettings(prev => ({ ...prev, marketplace_url: e.target.value }))}
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
            value={Array.isArray(settings.domain_aliases) ? settings.domain_aliases : []}
            onChange={(aliases) => setSettings((prev) => ({ ...prev, domain_aliases: aliases }))}
            theme={theme}
          />
        </SettingRow>

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Palette}
          title="Visual Core"
          description="Choose the visual style of your administration panel."
        >
          <div className={`flex p-1 rounded-2xl ${theme === 'dark' ? 'bg-slate-900 border border-slate-800 shadow-inner' : 'bg-slate-100/80 border border-slate-100 shadow-inner'}`}>
            <button onClick={() => theme === 'dark' && toggleTheme()} className={`flex items-center gap-2 px-6 py-2 text-[10px] font-bold uppercase tracking-tight rounded-xl transition-all ${theme === 'light' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-300'}`}>
              <FrameworkIcons.Sun size={14} /> Light
            </button>
            <button onClick={() => theme === 'light' && toggleTheme()} className={`flex items-center gap-2 px-6 py-2 text-[10px] font-bold uppercase tracking-tight rounded-xl transition-all ${theme === 'dark' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-indigo-600'}`}>
              <FrameworkIcons.Moon size={14} /> Dark
            </button>
          </div>
        </SettingRow>
      </Card>
    );
  }
}
