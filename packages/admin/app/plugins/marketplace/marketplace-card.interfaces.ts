import type React from 'react';
import type { PluginEntry } from '@fromcode119/core/client';

export interface MarketplacePluginCardProps {
  plugin: PluginEntry;
  theme: string;
  installed: any | undefined;
  installedVersion: string | null;
  hasUpdate: boolean;
  hasImageError: boolean;
  installing: string | null;
  onOpenDetail: () => void;
  onOpenInstalled: (e: React.MouseEvent) => void;
  onInstall: (e: React.MouseEvent) => void;
  onImageError: () => void;
}

export interface MarketplaceSearchBarProps {
  theme: string;
  searchQuery: string;
  onChange: (value: string) => void;
}
