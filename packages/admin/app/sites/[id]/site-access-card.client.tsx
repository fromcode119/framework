import type { ChangeEvent, ReactNode } from 'react';
import Link from 'next/link';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Input } from '@/components/ui/view/input.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Icon } from '@/components/view/icon.client';
import { PluginToggleScopeConstants, ThemeMode } from '@fromcode119/core/client';
import { Select } from '@/components/ui/view/select.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminApi } from '@/lib/api';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { SiteInventory } from '@/lib/tenants/site-inventory';
import { SiteFormValues } from '@/app/sites/site-form-values';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What this site is ENTITLED to run — not how any of it is configured.
 *
 * The distinction is the one WordPress Multisite draws between network-enabling a theme or plugin
 * (the network admin decides a site MAY use it) and activating and configuring it (the site's own
 * admin decides it DOES, and with what settings). Deciding what a customer's site may run is platform
 * work with nowhere else to happen; a plugin's settings belong on that plugin's page, inside the site.
 * An earlier version of this page carried both, which made it a worse copy of pages that already exist.
 */
export class SiteAccessCard extends AdminComponent {
  declare props: Pick<SiteAccessCard, 'values' | 'inventory' | 'onChange' | 'onActivated'>;

  /** Above this many rows a flat list stops being readable, so it gains a filter. */
  private static readonly SEARCH_THRESHOLD = 12;

  @prop declare values: SiteFormValues;
  @prop declare inventory: SiteInventory | null;
  @prop declare onChange: (values: SiteFormValues) => void;
  /** Re-reads the platform inventory after a plugin was activated here. */
  @prop declare onActivated: () => void;

  @state search = '';
  /** The slug being activated platform-wide, so its row can show progress. */
  @state activating = '';

  private get isDark(): boolean {
    return this.theme === ThemeMode.DARK;
  }

  @bound private onSearch(e: ChangeEvent<HTMLInputElement>): void {
    this.search = e.target.value;
  }

  /**
   * Turns a plugin on for this site — activating it on the PLATFORM first if that is all that is
   * missing.
   *
   * A plugin that is merely installed-and-off platform-wide used to render as a disabled switch with
   * "not enabled on this platform", which sent the operator to another page to flip it and back here to
   * flip it again. The person doing both is the same person; there is no decision in between. Held and
   * errored plugins still refuse, because those need a judgement (re-approving a capability change) or
   * a fix, and silently activating past either would be the wrong kind of helpful.
   */
  @bound private async togglePlugin(slug: string, enabled: boolean): Promise<void> {
    const plugin = this.inventory?.plugins.find((entry) => entry.slug === slug);
    if (enabled && plugin?.runnable === false) {
      this.activating = slug;
      try {
        // The platform axis, named: this card activates the plugin for the whole platform, whichever
        // site the session happens to be on. Left implicit, a session in a site scope made the same
        // click a per-site toggle, which refuses a plugin that is not active on the platform (409).
        await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.TOGGLE(slug), { enabled: true, scope: PluginToggleScopeConstants.PLATFORM });
        this.runtime.notify.addNotification({
          title: AdminI18n.t('sites.pluginActivated'),
          message: AdminI18n.t('sites.isNowActiveOnThis', { name: plugin.name }),
          type: NotificationType.INFO,
        });
        this.onActivated();
      } catch (err: any) {
        this.runtime.notify.addNotification({
          title: AdminI18n.t('sites.couldNotActivate'),
          message: err?.message || AdminI18n.t('sites.couldNotBeActivatedOn', { name: plugin.name }),
          type: NotificationType.ERROR,
        });
        this.activating = '';
        return;
      }
      this.activating = '';
    }

    const plugins = enabled
      ? [...this.values.plugins, slug]
      : this.values.plugins.filter((entry) => entry !== slug);
    this.onChange(this.values.with({ plugins }));
  }

  @bound private onTheme(theme: string): void {
    this.onChange(this.values.with({ theme }));
  }

  @bound private onAppearance(appearance: string): void {
    this.onChange(this.values.with({ appearance }));
  }

  /** Why a plugin cannot be run by any site, in the operator's terms. */
  private static stateLabel(plugin: { state?: string; heldReason?: string }): string {
    if (plugin.heldReason) return `held — ${plugin.heldReason.replace(/_/g, ' ')}; re-approve`;
    if (plugin.state === 'error') return AdminI18n.t('sites.failedToStart');
    return AdminI18n.t('sites.notEnabledOnThisPlatform');
  }

  /** Where an operator goes to make it runnable. A row that states a problem and offers nothing is a dead end. */
  private static stateHref(plugin: { slug: string; state?: string; heldReason?: string }): string {
    if (plugin.heldReason || plugin.state === 'error') return AdminConstants.ROUTES.PLUGINS.HEALTH;
    return AdminConstants.ROUTES.PLUGINS.DETAIL(plugin.slug);
  }

  private get visiblePlugins(): SiteInventory['plugins'] {
    const term = this.search.trim().toLowerCase();
    const plugins = this.inventory?.plugins ?? [];
    if (!term) return plugins;
    return plugins.filter((p) => p.name.toLowerCase().includes(term) || p.slug.toLowerCase().includes(term));
  }

  render(): ReactNode {
    const inventory = this.inventory;
    if (!inventory) return <Card title={AdminI18n.t('sites.access')}><p className="fc-sites__none">{AdminI18n.t('sites.loadingWhatThisPlatformHas')}</p></Card>;

    return (
      <>
        {/* A SITE has both: a storefront theme, and its own admin console's appearance (a per-site
            SETTING, `admin_appearance` — independent of the workspace lock, since a site is never
            locked to one). A WORKSPACE has only the console, and its appearance is the tenant row's
            own kind lock, not this setting. Without a picker here a site's own Settings → Appearance
            page — which lists only "default + whatever it currently wears" (T7) — had no way to ever
            offer more than the default: nothing set the "currently wears" past the built-in console. */}
        <Card title={AdminI18n.t('sites.appearance')}>
          <p className="fc-sites__text">
            {this.values.isWorkspace
              ? AdminI18n.t('sites.theConsoleThisWorkspaceS')
              : AdminI18n.t('sites.theConsoleThisSiteS')}
          </p>
          <Select
            theme={this.theme}
            value={this.values.appearance}
            onChange={this.onAppearance}
            placeholder={AdminI18n.t('sites.defaultConsole')}
            clearable
            options={inventory.appearances.map((entry) => ({ value: entry.slug, label: `${entry.name} ${entry.version}`.trim() }))}
          />
        </Card>

        {this.values.isWorkspace ? null : (
          <Card title={AdminI18n.t('sites.theme')}>
            <p className="fc-sites__text">
              {AdminI18n.t('sites.theThemeThisSiteS')}
            </p>
            <Select
              theme={this.theme}
              value={this.values.theme}
              onChange={this.onTheme}
              placeholder={AdminI18n.t('sites.noTheme')}
              clearable
              options={inventory.themes.map((entry) => ({ value: entry.slug, label: `${entry.name} ${entry.version}`.trim() }))}
            />
          </Card>
        )}

        <Card title={AdminI18n.t('sites.pluginsOf', { length: this.values.plugins.length, length2: inventory.plugins.length })}>
          <p className="fc-sites__text">
            {AdminI18n.t('sites.whichPluginsThisSiteMay')}
          </p>
          {inventory.plugins.length > SiteAccessCard.SEARCH_THRESHOLD
            ? <Input value={this.search} onChange={this.onSearch} placeholder={AdminI18n.t('sites.searchPlugins')} />
            : null}
          {/* The same row shape the Installed Plugins page uses — icon, name over description, then a
              right-hand group of metadata, state and the switch. The earlier version put the switch
              immediately after the name, so it landed at a different x on every row depending on how
              long the name was, and the list read as broken. */}
          <div className={`overflow-hidden divide-y mt-3 ${this.isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
            {this.visiblePlugins.map((plugin) => {
              const enabled = this.values.plugins.includes(plugin.slug);
              // Held or errored: a judgement or a fix is needed, so the switch cannot help.
              const blocked = Boolean(plugin.heldReason) || plugin.state === 'error';
              const dormant = plugin.runnable === false && !blocked;
              return (
                <div key={plugin.slug} className={`group flex items-center gap-3 px-3 py-2.5 transition-colors ${this.isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                  <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${this.isDark ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100'}`}>
                    <Icon name={plugin.icon || AdminI18n.t('sites.box')} size={18} strokeWidth={1.5} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-semibold tracking-tight ${this.isDark ? 'text-white' : 'text-slate-900'}`}>{plugin.name}</span>
                    <p className={`text-xs leading-snug truncate ${this.isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {blocked
                        ? <Link className="text-amber-600 dark:text-amber-400 no-underline" href={SiteAccessCard.stateHref(plugin)}>{SiteAccessCard.stateLabel(plugin)} →</Link>
                        : (plugin.description || AdminI18n.t('sites.runsOnThisSiteWhen'))}
                    </p>
                  </div>

                  <div className="flex items-center gap-5 shrink-0">
                    <span className={`hidden lg:inline text-[11px] tabular-nums ${this.isDark ? 'text-slate-500' : 'text-slate-400'}`}>v{plugin.version}</span>
                    <Badge
                      variant={blocked ? BadgeVariant.AMBER : (enabled ? BadgeVariant.SUCCESS : BadgeVariant.GRAY)}
                      className="shrink-0 justify-center w-[68px]"
                    >
                      {blocked ? AdminI18n.t('sites.blocked') : enabled ? AdminI18n.t('sites.on') : dormant ? AdminI18n.t('sites.dormant') : AdminI18n.t('sites.off')}
                    </Badge>
                    <Switch
                      checked={enabled}
                      onChange={(checked: boolean) => void this.togglePlugin(plugin.slug, checked)}
                      disabled={blocked || this.activating === plugin.slug}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </>
    );
  }
}
