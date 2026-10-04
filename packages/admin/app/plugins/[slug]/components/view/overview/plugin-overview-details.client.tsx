import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { DetailBox } from '@/components/view/detail-box.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the plugin is, as its manifest declares it. A site's own upload names that site as its source; a
 * manifest without an author shows none — never a provenance it does not have.
 */
export class PluginOverviewDetails extends PureReactor {
  @prop declare plugin: ILoadedPlugin;
  @prop declare marketplaceVersion: string | null;
  /** Opens the Security tab — offered only where that tab exists (Platform scope). */
  @prop declare onOpenSecurity: (() => void) | null;
  @prop declare theme: ThemeMode;

  private row(label: string, value: ReactNode): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <div key={label} className="flex items-center justify-between gap-4 py-1.5 text-[13px]">
        <span className={dark ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
        <span className={`text-right font-medium ${dark ? 'text-slate-100' : 'text-slate-800'}`}>{value}</span>
      </div>
    );
  }

  render(): ReactNode {
    const { plugin, theme } = this;
    const manifest = plugin.manifest as typeof plugin.manifest & { ownerTenantId?: string };
    const owner = String(manifest.ownerTenantId ?? '').trim();
    const author = String((typeof manifest.author === 'object' ? manifest.author?.name : manifest.author) ?? '').trim();
    const capabilities = manifest.capabilities?.length ?? 0;
    const capabilityText = capabilities ? AdminI18n.t('plugins.detail.capabilitiesDeclared', { count: capabilities }) : AdminI18n.t('plugins.detail.none');
    return (
      <DetailBox title={AdminI18n.t('plugins.detail.manifestDetails')} theme={theme}>
        {this.row(AdminI18n.t('plugins.detail.version'), manifest.version)}
        {this.marketplaceVersion && this.marketplaceVersion !== manifest.version ? this.row(AdminI18n.t('plugins.detail.availableVersion'), this.marketplaceVersion) : null}
        {owner ? this.row(AdminI18n.t('plugins.detail.source'), AdminI18n.t('plugins.detail.uploadedBySite', { site: owner })) : null}
        {!owner && author ? this.row(AdminI18n.t('plugins.detail.author'), author) : null}
        {manifest.category ? this.row(AdminI18n.t('plugins.detail.category'), manifest.category) : null}
        {this.row(AdminI18n.t('plugins.detail.capabilities'), capabilities && this.onOpenSecurity
          ? <button type="button" onClick={this.onOpenSecurity} className="text-indigo-500 hover:underline">{capabilityText} ›</button>
          : capabilityText)}
      </DetailBox>
    );
  }
}
