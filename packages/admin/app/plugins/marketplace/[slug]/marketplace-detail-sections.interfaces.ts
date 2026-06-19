import type { PluginEntry } from '@fromcode119/core/client';
import type { PluginInstallOperation } from '@/lib/plugin-install-operation.interfaces';

export interface MarketplaceDetailHeaderProps {
  plugin: PluginEntry;
  theme: string;
  allVersions: PluginEntry[];
  selectedVersion: string;
  installedPlugin: any | null;
  onSelectVersion: (version: string) => void;
}

export interface MarketplaceScreenshotsProps {
  plugin: PluginEntry;
  theme: string;
  activeImageIndex: number;
  onOpenLightbox: () => void;
  onSelectImage: (idx: number) => void;
}

export interface MarketplaceChangelogProps {
  plugin: PluginEntry;
  theme: string;
}

export interface MarketplaceDetailSidebarProps {
  plugin: PluginEntry;
  theme: string;
  installedPlugin: any | null;
  installedVersion: string | null;
  hasUpdate: boolean;
  installing: boolean;
  installOperation: PluginInstallOperation | null;
  onInstall: () => void;
}
