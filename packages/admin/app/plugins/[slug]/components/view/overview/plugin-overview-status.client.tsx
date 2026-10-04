import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Switch } from '@/components/ui/view/switch.client';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { PluginRegistryHealth, PluginState } from '@fromcode119/core/client';
import { PluginSiteOfferSwitch } from '@/app/plugins/[slug]/components/view/offer/plugin-site-offer-switch.client';
import { DetailBox } from '@/components/view/detail-box.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Whether the plugin runs, and — for the platform — its switch and whether sites may turn it on. In a
 * site both are the platform's, so the box says where they are instead of offering a dead control.
 */
export class PluginOverviewStatus extends PureReactor {
  @prop declare onToggle: () => void;
  @prop declare plugin: ILoadedPlugin;
  @prop declare siteScope: boolean;
  @prop declare theme: ThemeMode;

  private get isActive(): boolean {
    return PluginState.resolve(this.plugin.state) === PluginState.ACTIVE;
  }

  /** Held: a newer release asks for more than was approved — turning it on approves the difference. */
  private get isHeld(): boolean {
    return PluginRegistryHealth.resolve(this.plugin.healthStatus) === PluginRegistryHealth.WARNING || Boolean(this.plugin.heldReason);
  }

  private get ownerSite(): string {
    return String((this.plugin.manifest as { ownerTenantId?: string }).ownerTenantId ?? '').trim();
  }

  render(): ReactNode {
    const { plugin, theme, siteScope } = this;
    const dark = theme === ThemeMode.DARK;
    const active = this.isActive;
    const label = this.isHeld ? AdminI18n.t('plugins.detail.approveEnable') : active ? AdminI18n.t('plugins.detail.active') : AdminI18n.t('plugins.detail.disabled');
    return (
      <DetailBox title={AdminI18n.t('plugins.detail.runtimeStatus')} theme={theme}>
        <div className="flex items-center justify-between gap-4 py-1.5 text-[13px]">
          <span className={`flex items-center gap-2 font-medium ${active ? 'text-emerald-500' : dark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-500'}`} />
            {PluginState.resolve(plugin.state) === PluginState.ERROR ? AdminI18n.t('plugins.detail.stateError') : label}
          </span>
          {!siteScope ? <Switch checked={active} onChange={(_: boolean) => this.onToggle()} /> : null}
        </div>
        {siteScope ? <p className={`mt-2 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{AdminI18n.t('plugins.detail.switchInPlatformScope')}</p> : null}
        {!siteScope && !this.ownerSite ? <PluginSiteOfferSwitch slug={plugin.manifest.slug} /> : null}
        {!siteScope && this.ownerSite ? <p className={`mt-2 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{AdminI18n.t('plugins.detail.siteOwnNotOffered', { site: this.ownerSite })}</p> : null}
      </DetailBox>
    );
  }
}
