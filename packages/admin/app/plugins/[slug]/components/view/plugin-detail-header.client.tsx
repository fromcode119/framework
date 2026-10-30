import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { Badge } from '@/components/ui/view/badge.client';
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
 * tab you are on (settings: save; resources: save the policy). Everything that is not an everyday action
 * (exporting, importing or resetting the settings, the raw definition) sits in the ⋯ menu.
 */
export class PluginDetailHeader extends PureReactor {
  @prop declare activeTab: PluginDetailTab;
  @prop declare isSaving: boolean;
  @prop declare onOpenDefinition: () => void;
  @prop declare onSaveSandbox: () => void;
  /** The platform's own actions (definition, the resource policy) — only in Platform scope, for a platform admin. */
  @prop declare platformActions: boolean;
  @prop declare plugin: ILoadedPlugin;
  @prop declare settingsDirty: boolean;
  @prop declare settingsFormRef: Ref<IPluginSettingsFormHandle | null>;
  /** False for a plugin with nothing to set (or one that is not running yet): no Save, Export, Import or Reset. */
  @prop declare settingsHasFields: boolean;
  @prop declare settingsSaving: boolean;
  @prop declare theme: ThemeMode;

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

  private button(label: ReactNode, onClick: () => void, primary = false, disabled = false): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    const tone = primary
      ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'
      : (dark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50');
    return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-medium transition-colors ${primary ? 'font-semibold' : ''} ${tone}`}>{label}</button>;
  }

  private settingsActions(): ReactNode {
    const { settingsDirty, settingsSaving } = this;
    return (
      <>
        {settingsDirty ? <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-500"><span className="h-2 w-2 rounded-full bg-amber-500" />{AdminI18n.t('plugins.detail.unsavedChanges')}</span> : null}
        <button type="submit" form="plugin-settings-form" disabled={settingsSaving || !settingsDirty}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-600 bg-indigo-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
          {settingsSaving ? <FrameworkIcons.Loader size={14} className="animate-spin" /> : <FrameworkIcons.Check size={14} />}
          {settingsSaving ? AdminI18n.t('plugins.detail.saving') : AdminI18n.t('plugins.detail.saveSettings')}
        </button>
      </>
    );
  }

  render(): ReactNode {
    const { activeTab, plugin } = this;
    const items = this.menuItems;
    const subtitle = (
      <span className="inline-flex flex-wrap items-center gap-x-2">
        <Badge variant={PluginState.resolve(plugin.state) === PluginState.ACTIVE ? 'success' : 'gray'}>{this.stateLabel}</Badge>
        <span>v{plugin.manifest.version}</span>
        {this.author ? <><span>·</span><span>{this.author}</span></> : null}
        {/* The vendor: an install refuses a same-slug plugin from another one, so it is shown. */}
        <span>·</span>
        <span title={AdminI18n.t('plugins.detail.vendorHelp')}>{String(plugin.manifest.namespace || '').trim() || AdminI18n.t('plugins.detail.noVendorDeclared')}</span>
      </span>
    );
    const actions = (
      <>
        {(activeTab === PluginDetailTab.SETTINGS || (activeTab === PluginDetailTab.PLATFORM_SETTINGS && this.platformActions)) && this.settingsHasFields ? this.settingsActions() : null}
        {activeTab === PluginDetailTab.RESOURCES && this.platformActions ? this.button(this.isSaving ? AdminI18n.t('plugins.detail.saving') : AdminI18n.t('plugins.detail.updatePolicy'), this.onSaveSandbox, true, this.isSaving) : null}
        {items.length ? (
          <Dropdown align={HorizontalAlign.RIGHT} items={items} trigger={
            <span aria-label={AdminI18n.t('common.more')} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <FrameworkIcons.More size={16} />
            </span>
          } />
        ) : null}
      </>
    );
    // The same header every settings page has; the back arrow returns to the installed list.
    return <CompactPageHeader backHref={AdminConstants.ROUTES.PLUGINS.INSTALLED} icon={<FrameworkIcons.Plugins />} title={plugin.manifest.name} subtitle={subtitle} actions={actions} />;
  }
}
