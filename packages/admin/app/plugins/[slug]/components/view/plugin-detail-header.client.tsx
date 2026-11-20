import type { ReactNode } from 'react';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { Icon } from '@/components/view/icon.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import { FrameworkIcons } from '@fromcode119/react';
import { PluginState } from '@fromcode119/core/client';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import type { IPluginSettingsFormHandle } from '@/components/plugins/interfaces/plugin-settings-form-handle.interface';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { PluginDetailTab } from '@/app/plugins/[slug]/enums/plugin-detail-tab.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The page's header (the shared compact one): which plugin, its state and version — and the one action of the
 * tab you are on. Settings and the resource policy are saved from the bar at the foot of the page,
 * which shows only while something is changed, like on every other settings page. Everything that is not an everyday action
 * (exporting, importing or resetting the settings, the raw definition) sits in the ⋯ menu.
 */
export class PluginDetailHeader extends PureReactor {
  @prop declare activeTab: PluginDetailTab;
  @prop declare onOpenDefinition: () => void;
  /** The platform's own actions (the raw definition) — only in Platform scope, for a platform admin. */
  @prop declare platformActions: boolean;
  @prop declare plugin: ILoadedPlugin;
  @prop declare settingsFormRef: Ref<IPluginSettingsFormHandle | null>;
  /** False for a plugin with nothing to set (or one that is not running yet): no Save, Export, Import or Reset. */
  @prop declare settingsHasFields: boolean;

  /** The state in the operator's words; `plugin.state` may still be a plain string before hydration. */
  private get stateLabel(): string {
    const state = PluginState.resolve(this.plugin.state);
    if (state === PluginState.ACTIVE) return AdminI18n.t('plugins.detail.stateActive');
    if (state === PluginState.LOADING) return AdminI18n.t('plugins.detail.stateLoading');
    if (state === PluginState.ERROR) return AdminI18n.t('plugins.detail.stateError');
    return AdminI18n.t('plugins.detail.stateInactive');
  }

  private get author(): string {
    const declared = this.plugin.manifest.author;
    return String((typeof declared === 'object' ? declared?.name : declared) ?? '').trim();
  }

  private get menuItems(): IDropdownItem[] {
    const items: IDropdownItem[] = [];
    if (this.platformActions) items.push({ label: AdminI18n.t('plugins.detail.viewDefinition'), icon: <FrameworkIcons.Code size={14} />, onClick: this.onOpenDefinition });
    if (this.activeTab === PluginDetailTab.SETTINGS && this.settingsHasFields) {
      items.push({ label: AdminI18n.t('common.export'), icon: <FrameworkIcons.Download size={14} />, onClick: () => this.settingsFormRef.current?.exportSettings() });
      items.push({ label: AdminI18n.t('common.import'), icon: <FrameworkIcons.Upload size={14} />, onClick: () => this.settingsFormRef.current?.importSettings() });
      items.push({ label: AdminI18n.t('plugins.detail.resetSettingsToDefaults'), icon: <FrameworkIcons.Refresh size={14} />, variant: DropdownItemVariant.DANGER, onClick: () => this.settingsFormRef.current?.resetSettings() });
    }
    return items;
  }

  render(): ReactNode {
    const { plugin } = this;
    const items = this.menuItems;
    // One quiet line: state, version, author. The vendor id (an install refuses a same-slug plugin from
    // another vendor) is the author's tooltip rather than a fourth word on the line.
    const vendor = String(plugin.manifest.namespace || '').trim() || AdminI18n.t('plugins.detail.noVendorDeclared');
    const subtitle = [this.stateLabel, `v${plugin.manifest.version}`].join(' · ');
    const byline = (
      <span title={`${vendor} — ${AdminI18n.t('plugins.detail.vendorHelp')}`}>
        {this.author ? `${subtitle} · ${this.author}` : `${subtitle} · ${vendor}`}
      </span>
    );
    const actions = (
      <>
        {items.length ? (
          <Dropdown align={HorizontalAlign.RIGHT} items={items} trigger={
            <span aria-label={AdminI18n.t('common.more')} className="fc-toolbar-btn fc-toolbar-btn--icon">
              <FrameworkIcons.More size={16} />
            </span>
          } />
        ) : null}
      </>
    );
    // The same header every settings page has; the back arrow returns to the installed list.
    const icon = <Icon name={String((plugin.manifest as { admin?: { icon?: string } }).admin?.icon || 'Box')} size={18} strokeWidth={1.75} />;
    return <CompactPageHeader backHref={AdminConstants.ROUTES.PLUGINS.INSTALLED} mark={icon} title={plugin.manifest.name} subtitle={byline} actions={actions} />;
  }
}
