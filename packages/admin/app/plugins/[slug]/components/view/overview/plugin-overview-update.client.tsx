import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { IPluginMarketplaceItem } from '@/app/plugins/[slug]/interfaces/plugin-marketplace-item.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A newer release is ready: its version, what is new in it, and — for the platform — the button that
 * installs it. A site sees that it exists; updating is the platform's.
 */
export class PluginOverviewUpdate extends PureReactor {
  @prop declare item: IPluginMarketplaceItem;
  @prop declare canUpdate: boolean;
  @prop declare isUpdating: boolean;
  @prop declare onUpdate: () => void;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    const changes = Array.isArray(this.item.changelog) ? this.item.changelog : [];
    return (
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <FrameworkIcons.Download size={16} className={dark ? 'text-indigo-300' : 'text-indigo-600'} />
          <span className={`text-[13px] font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{AdminI18n.t('plugins.detail.versionReady', { version: this.item.version })}</span>
          <span className="flex-1" />
          {this.canUpdate ? (
            <button type="button" onClick={this.onUpdate} disabled={this.isUpdating}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-[13px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
              {this.isUpdating ? <FrameworkIcons.Loader size={13} className="animate-spin" /> : <FrameworkIcons.Zap size={13} />}
              {this.isUpdating ? AdminI18n.t('plugins.detail.updating') : AdminI18n.t('plugins.detail.updateAvailable')}
            </button>
          ) : null}
        </div>
        {changes.length ? (
          <ul className={`mt-2 space-y-1 pl-7 text-[13px] ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
            {changes.map((change) => <li key={change} className="list-disc">{change}</li>)}
          </ul>
        ) : null}
      </div>
    );
  }
}
