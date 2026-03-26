import type { RefObject } from 'react';
import type { LoadedPlugin } from '@fromcode119/core/client';
import type { PluginSettingsFormHandle } from '@/components/plugins/plugin-settings-form.interfaces';

export type PluginDetailTab = 'overview' | 'settings' | 'permissions' | 'resources';

export interface PluginLogEntry {
  id?: string | number;
  timestamp: string;
  message: string;
  level: string;
}

export interface PluginMarketplaceItem {
  slug: string;
  version: string;
  changelog?: string[];
}

export interface PluginSandboxSettings {
  enabled: boolean;
  memoryLimit: number;
  timeout: number;
  allowNative: boolean;
}

export interface PluginDetailHeaderProps {
  activeTab: PluginDetailTab;
  isSaving: boolean;
  isUpdating: boolean;
  marketplaceItem: PluginMarketplaceItem | null;
  onSaveSandbox: () => void;
  onUpdate: () => void;
  plugin: LoadedPlugin;
  theme: string;
}

export interface PluginDetailTabsProps {
  activeTab: PluginDetailTab;
  onTabChange: (tabId: PluginDetailTab) => void;
  theme: string;
}

export interface PluginDetailOverviewProps {
  loadingLogs: boolean;
  logs: PluginLogEntry[];
  marketplaceItem: PluginMarketplaceItem | null;
  onRefreshLogs: () => void;
  onToggle: () => void;
  plugin: LoadedPlugin;
  theme: string;
}

export interface PluginDetailPermissionsProps {
  plugin: LoadedPlugin;
  theme: string;
}

export interface PluginDetailResourcesProps {
  onSandboxSettingsChange: (value: PluginSandboxSettings) => void;
  sandboxSettings: PluginSandboxSettings;
  theme: string;
}

export interface PluginDetailSidebarProps {
  activeTab: PluginDetailTab;
  onOpenDefinition: () => void;
  onOpenDeleteConfirm: () => void;
  onTabChange: (tabId: PluginDetailTab) => void;
  plugin: LoadedPlugin;
  settingsDirty: boolean;
  settingsFormRef: RefObject<PluginSettingsFormHandle | null>;
  settingsSaving: boolean;
  theme: string;
}

export interface PluginManifestModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugin: LoadedPlugin;
  theme: string;
}

export interface PluginDetailViewProps {
  activeTab: PluginDetailTab;
  isDeleting: boolean;
  isSaving: boolean;
  isUpdating: boolean;
  loadingLogs: boolean;
  logs: PluginLogEntry[];
  marketplaceItem: PluginMarketplaceItem | null;
  onDelete: () => void;
  onOpenDefinition: () => void;
  onOpenDeleteConfirm: () => void;
  onRefreshLogs: () => void;
  onSaveSandbox: () => void;
  onSandboxSettingsChange: (value: PluginSandboxSettings) => void;
  onSettingsStateChange: (dirty: boolean, saving: boolean) => void;
  onTabChange: (tabId: PluginDetailTab) => void;
  onToggle: () => void;
  onUpdate: () => void;
  onCloseDeleteConfirm: () => void;
  onCloseDefinition: () => void;
  plugin: LoadedPlugin;
  sandboxSettings: PluginSandboxSettings;
  settingsDirty: boolean;
  settingsFormRef: RefObject<PluginSettingsFormHandle | null>;
  settingsSaving: boolean;
  showDefinition: boolean;
  showDeleteConfirm: boolean;
  slug: string;
  theme: string;
}

export interface PluginDetailPageModel {
  activeTab: PluginDetailTab;
  fetchLogs: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleSaveSandbox: () => Promise<void>;
  handleTabChange: (tabId: PluginDetailTab) => void;
  handleToggle: () => Promise<void>;
  handleUpdate: () => Promise<void>;
  isDeleting: boolean;
  isSaving: boolean;
  isUpdating: boolean;
  loading: boolean;
  loadingLogs: boolean;
  logs: PluginLogEntry[];
  marketplaceItem: PluginMarketplaceItem | null;
  plugin: LoadedPlugin | null;
  sandboxSettings: PluginSandboxSettings;
  setSandboxSettings: (value: PluginSandboxSettings) => void;
  setSettingsDirty: (value: boolean) => void;
  setSettingsSaving: (value: boolean) => void;
  settingsDirty: boolean;
  settingsFormRef: RefObject<PluginSettingsFormHandle | null>;
  settingsSaving: boolean;
  setShowDefinition: (value: boolean) => void;
  setShowDeleteConfirm: (value: boolean) => void;
  showDefinition: boolean;
  showDeleteConfirm: boolean;
  theme: string;
}
