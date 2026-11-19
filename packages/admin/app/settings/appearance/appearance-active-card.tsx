import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { AppearanceItem } from '@/app/settings/appearance/appearance-item';
import { AppearanceCatalogItem } from '@/app/settings/appearance/appearance-catalog-item';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The installed appearances (default + installed) with the selected card, update badge, and remove. */
export class AppearanceActiveCard extends PureReactor {
  @prop declare items: AppearanceItem[];
  @prop declare catalogBySlug: Record<string, AppearanceCatalogItem>;
  @prop declare active: string;
  @prop declare busy: boolean;
  @prop declare dark: boolean;
  @prop declare onSwitch: (slug: string) => void;
  @prop declare onUpdate: (item: AppearanceItem) => void;
  @prop declare onRemove: (slug: string) => void;
  /** Installing/removing the PACKAGE is the platform's; picking which one this site wears is not. */
  @prop declare canManagePackages: boolean;
  /**
   * May this scope CHOOSE the appearance? `admin_appearance` is per-site, so with no site selected
   * there is no row to write and the API refuses — the cards must not be selectable.
   */
  @prop declare canChoose: boolean;

  private subtitle(item: AppearanceItem): string {
    if (item.builtIn) return AdminI18n.t('settings.appearance.builtIn');
    const version = item.version ? `v${item.version}` : AdminI18n.t('settings.appearance.installed');
    // The vendor beside the version: a same-slug appearance from another vendor is refused at install.
    return `${version} · ${item.namespace || AdminI18n.t('settings.appearance.noVendorDeclared')}`;
  }

  render(): ReactNode {
    const { items, catalogBySlug, active, busy, onSwitch, onUpdate, onRemove, canManagePackages, canChoose } = this;
    return (
      <ListShell title={AdminI18n.t('settings.appearance.activeAppearance')} count={items.length}>
        <div>
          {items.map((it) => {
            const catalog = catalogBySlug[it.slug];
            const canUpdate = !it.builtIn && (!!catalog?.updateAvailable || !!it.sourceUrl);
            const menu = !it.builtIn && canManagePackages ? [
              ...(canUpdate ? [{ label: catalog?.updateAvailable ? AdminI18n.t('settings.appearance.updateToV', { version: catalog.version }) : AdminI18n.t('settings.appearance.reInstall'), icon: <FrameworkIcons.Refresh size={15} />, onClick: () => { if (!busy) onUpdate(it); } }] : []),
              { label: AdminI18n.t('settings.appearance.remove'), icon: <FrameworkIcons.Trash size={15} />, variant: DropdownItemVariant.DANGER, onClick: () => { if (!busy) onRemove(it.slug); } },
            ] : undefined;
            return (
              <ListRow
                key={it.slug}
                icon={<FrameworkIcons.Palette size={16} />}
                title={it.name}
                badges={catalog?.updateAvailable ? <Badge variant={BadgeVariant.WARNING}>{AdminI18n.t('settings.appearance.updateToVersion', { version: catalog.version })}</Badge> : undefined}
                description={this.subtitle(it)}
                menu={menu}
                // The one in use is on and stays on: an appearance is left by choosing another.
                actions={<Switch checked={active === it.slug} disabled={busy || !canChoose || active === it.slug} onChange={() => onSwitch(it.slug)} />}
              />
            );
          })}
        </div>
      </ListShell>
    );
  }
}
