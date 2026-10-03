import { ThemeMode, PluginConsentSummary } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { Card } from '@/components/ui/view/card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { PluginConsentEntries } from '@/components/plugins/view/plugin-consent-entries.client';
import type { IPluginConsentSummary } from '@/components/plugins/interfaces/plugin-consent-summary.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the plugin may do, in the same words and risk groups as the consent dialog that approved it —
 * every capability and host it asks for, with the ones nobody approved yet marked new.
 */
export class PluginDetailPermissions extends PureReactor {
  @prop declare plugin: ILoadedPlugin;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const { plugin, theme } = this;
    const summary = PluginConsentSummary.of(plugin.manifest, plugin.approvedCapabilities || []) as IPluginConsentSummary;
    return (
      <Card className={`border-0 p-5 ${theme === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
        <h3 className={`text-[11px] font-semibold uppercase tracking-wider mb-5 ${theme === ThemeMode.DARK ? 'text-slate-500' : 'text-slate-400'}`}>
          {AdminI18n.t('plugins.detail.securityCapabilities')}
        </h3>
        {summary.entries.length > 0 ? (
          <>
            {summary.requiresApproval ? (
              <p className="mb-4 text-[13px] text-amber-700 dark:text-amber-300">{AdminI18n.t('plugins.detail.requiresYourApproval')}</p>
            ) : null}
            <PluginConsentEntries entries={summary.entries} anyHostReason={summary.anyHostReason} />
          </>
        ) : (
          <div className="py-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
            <FrameworkIcons.Shield className="text-slate-200 dark:text-slate-800 mb-3" size={40} />
            <p className="text-slate-500 font-semibold text-sm">{AdminI18n.t('plugins.detail.standardIsolation')}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wider">{AdminI18n.t('plugins.detail.minimalSystemPermissions')}</p>
          </div>
        )}
      </Card>
    );
  }
}
