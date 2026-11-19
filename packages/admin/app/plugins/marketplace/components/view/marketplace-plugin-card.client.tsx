import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { MouseEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IPluginEntry } from '@fromcode119/core/client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { Tooltip } from '@/components/ui/view/tooltip.client';
import { FrameworkIcons } from '@fromcode119/react';
import { Icon } from '@/components/view/icon.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { MarketplacePluginCopy } from '@/app/plugins/marketplace/marketplace-plugin-copy';

/**
 * One plugin of the catalogue, as the same row an installed plugin is: its icon, name and state, what
 * it does, its version and maker, and the one thing to do with it at the end. It was a tall tile with
 * a full-width coloured button, so the catalogue and the list of what is installed looked like two
 * different programs.
 */
export class MarketplacePluginCard extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<MarketplacePluginCard, 'plugin' | 'theme' | 'installed' | 'installedVersion' | 'hasUpdate' | 'hasImageError' | 'installing' | 'canInstall' | 'onOpenDetail' | 'onOpenInstalled' | 'onInstall' | 'onImageError'>;

  @prop declare plugin: IPluginEntry;
  @prop declare theme: ThemeMode;
  @prop declare installed: any | undefined;
  @prop declare installedVersion: string | null;
  @prop declare hasUpdate: boolean;
  @prop declare hasImageError: boolean;
  @prop declare installing: string | null;
  /** May this admin install onto the platform? Installing puts code on every site, so only the platform may. */
  @prop declare canInstall: boolean;
  @prop declare onOpenDetail: () => void;
  @prop declare onOpenInstalled: (e: MouseEvent) => void;
  @prop declare onInstall: (e: MouseEvent) => void;
  @prop declare onImageError: () => void;

  /** The one action the row offers, by what the plugin is here. */
  private action(): ReactNode {
    const { plugin, installed, hasUpdate, installing, canInstall } = this;
    const busy = installing === plugin.slug;
    if (installed && !hasUpdate) {
      return <Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Check size={15} />} onClick={this.onOpenInstalled}>{AdminI18n.t('plugins.list.installed')}</Button>;
    }
    if (!canInstall) {
      return <Tooltip content={AdminI18n.t('plugins.list.installingAPluginPutsCode')}><Badge>{AdminI18n.t('plugins.list.platformAdminInstallsThis')}</Badge></Tooltip>;
    }
    if (hasUpdate) {
      return <Button variant={ButtonVariant.PRIMARY} isLoading={busy} disabled={Boolean(installing)} icon={<FrameworkIcons.Refresh size={15} />} onClick={this.onInstall}>{busy ? AdminI18n.t('plugins.list.updating') : AdminI18n.t('plugins.list.updatePlugin')}</Button>;
    }
    return <Button variant={ButtonVariant.SECONDARY} isLoading={busy} disabled={Boolean(installing)} icon={<FrameworkIcons.Download size={15} />} onClick={this.onInstall}>{busy ? AdminI18n.t('plugins.list.installing') : AdminI18n.t('plugins.list.installNow')}</Button>;
  }

  render(): ReactNode {
    const { plugin, installed, installedVersion, hasUpdate, hasImageError } = this;
    // Built on THIS server through Sources rather than offered by a catalogue. Both arrive in one
    // merged list, so without saying so the screen offers an operator who is connected to no
    // marketplace a page that looks exactly like a marketplace.
    const isBuiltHere = String(plugin.source || '') === 'local';
    const label = MarketplacePluginCopy.label(plugin, installed);
    const description = MarketplacePluginCopy.description(plugin, installed);
    return (
      <ListRow
        icon={plugin.iconUrl && !hasImageError
          ? <img src={plugin.iconUrl} alt="" onError={this.onImageError} />
          : <Icon name={String(plugin.icon || 'Box')} size={16} />}
        title={<button type="button" className="fc-ext-row__link" onClick={this.onOpenDetail}>{label}</button>}
        badges={(
          <>
            {hasUpdate ? <Badge variant={BadgeVariant.WARNING}>{AdminI18n.t('plugins.list.updateFromTo', { from: installedVersion, to: plugin.version })}</Badge> : null}
            {installed && !hasUpdate ? <Badge variant={BadgeVariant.SUCCESS}>{AdminI18n.t('plugins.list.installed')}</Badge> : null}
            {isBuiltHere ? <Tooltip content={AdminI18n.t('plugins.list.builtOnThisServerFrom')}><Badge variant={BadgeVariant.INFO}>{AdminI18n.t('plugins.list.builtHere')}</Badge></Tooltip> : null}
            {plugin.isFeatured ? <Badge variant={BadgeVariant.INFO}>{AdminI18n.t('plugins.list.featured')}</Badge> : null}
            {plugin.isTrending ? <Badge>{AdminI18n.t('plugins.list.trending')}</Badge> : null}
            {plugin.isVerified ? <Tooltip content={AdminI18n.t('plugins.list.verifiedPublisher')}><Badge variant={BadgeVariant.SUCCESS}>{AdminI18n.t('plugins.list.verifiedPublisher')}</Badge></Tooltip> : null}
            {!installed && plugin.category ? <Badge>{plugin.category}</Badge> : null}
          </>
        )}
        description={description || undefined}
        descriptionTitle={description || undefined}
        meta={[`v${plugin.version}`, plugin.author].filter(Boolean).join(' · ')}
        actions={this.action()}
      />
    );
  }
}
