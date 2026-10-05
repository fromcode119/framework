import type { IPluginConsentSummary } from '@/components/plugins/interfaces/plugin-consent-summary.interface';
import { ThemeMode } from '@fromcode119/core/client';
import type { RefObject } from 'react';
import type { ILoadedPlugin, ISettingsTabGroup } from '@fromcode119/core/client';
import type { IPluginSettingsFormHandle } from '@/components/plugins/interfaces/plugin-settings-form-handle.interface';
import { IPluginInstallOperation } from '@/lib/interfaces/plugin-install-operation.interface';
import { PluginDetailTab } from '@/app/plugins/[slug]/enums/plugin-detail-tab.enum';
import type { IPluginLogEntry } from '@/app/plugins/[slug]/interfaces/plugin-log-entry.interface';
import type { IPluginMarketplaceItem } from '@/app/plugins/[slug]/interfaces/plugin-marketplace-item.interface';
import type { IPluginSandboxSettings } from '@/app/plugins/[slug]/interfaces/plugin-sandbox-settings.interface';

export interface IPluginDetailPageModel {
  /** The consent dialog for this plugin, when turning it on needs an approval first. */
  consentSlugs: string[];
  consentInitial: IPluginConsentSummary | null;
  consentFinished: () => Promise<void>;
  activeTab: PluginDetailTab;
  /** The plugin's settings groups (each a page tab); empty means one "Settings" tab. */
  settingsGroups: ISettingsTabGroup[];
  settingsGroup: string;
  settingsSection: string;
  /** The operator is standing in a site: the platform's controls for this plugin are not offered here. */
  siteScope: boolean;
  fetchLogs: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleSaveSandbox: () => Promise<void>;
  handleTabChange: (tabId: PluginDetailTab, group?: string, section?: string) => void;
  handleToggle: () => Promise<void>;
  handleUpdate: () => Promise<void>;
  isDeleting: boolean;
  /** The effective platform default (Settings → Infrastructure → Plugin Isolation), or `null` until fetched. */
  isolationDefaults: { memoryMb: number; timeoutMs: number } | null;
  isSaving: boolean;
  isUpdating: boolean;
  installOperation: IPluginInstallOperation | null;
  loading: boolean;
  loadingLogs: boolean;
  logs: IPluginLogEntry[];
  marketplaceItem: IPluginMarketplaceItem | null;
  plugin: ILoadedPlugin | null;
  sandboxSettings: IPluginSandboxSettings;
  setSandboxSettings: (value: IPluginSandboxSettings) => void;
  setSettingsDirty: (value: boolean) => void;
  setSettingsSaving: (value: boolean) => void;
  settingsDirty: boolean;
  settingsFormRef: RefObject<IPluginSettingsFormHandle | null>;
  settingsSaving: boolean;
  /** The plugin offers settings to change, so Save, Export and Reset mean something. */
  settingsHasFields: boolean;
  setSettingsHasFields: (value: boolean) => void;
  setShowDefinition: (value: boolean) => void;
  setShowDeleteConfirm: (value: boolean) => void;
  showDefinition: boolean;
  showDeleteConfirm: boolean;
  theme: ThemeMode;
}
