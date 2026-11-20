import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
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

  render(): ReactNode {
    const { plugin, theme } = this;
    const manifest = plugin.manifest as typeof plugin.manifest & { ownerTenantId?: string };
    const owner = String(manifest.ownerTenantId ?? '').trim();
    const author = String((typeof manifest.author === 'object' ? manifest.author?.name : manifest.author) ?? '').trim();
    const capabilities = manifest.capabilities?.length ?? 0;
    const capabilityText = capabilities ? AdminI18n.t('plugins.detail.capabilitiesDeclared', { count: capabilities }) : AdminI18n.t('plugins.detail.none');
    const facts = [
      { key: 'version', label: AdminI18n.t('plugins.detail.version'), value: manifest.version },
      ...(this.marketplaceVersion && this.marketplaceVersion !== manifest.version ? [{ key: 'available', label: AdminI18n.t('plugins.detail.availableVersion'), value: this.marketplaceVersion }] : []),
      ...(owner ? [{ key: 'source', label: AdminI18n.t('plugins.detail.source'), value: AdminI18n.t('plugins.detail.uploadedBySite', { site: owner }) }] : []),
      ...(!owner && author ? [{ key: 'author', label: AdminI18n.t('plugins.detail.author'), value: author }] : []),
      ...(manifest.category ? [{ key: 'category', label: AdminI18n.t('plugins.detail.category'), value: manifest.category }] : []),
      { key: 'capabilities', label: AdminI18n.t('plugins.detail.capabilities'), value: capabilityText },
    ];
    return (
      <DetailBox title={AdminI18n.t('plugins.detail.manifestDetails')} theme={theme}
        action={capabilities && this.onOpenSecurity ? <Button variant={ButtonVariant.GHOST} onClick={this.onOpenSecurity}>{AdminI18n.t('plugins.detail.capabilities')}</Button> : undefined}>
        <AdminFactGrid facts={facts as any} />
      </DetailBox>
    );
  }
}
