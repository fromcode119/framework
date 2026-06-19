import type React from 'react';
import type { MarketplaceTheme } from '@fromcode119/core/client';

export interface ThemeMarketplaceHeaderProps {
  theme: MarketplaceTheme;
  adminTheme: string;
  allVersions: MarketplaceTheme[];
  selectedVersion: string;
  installedTheme: any | null;
  hasUpdate: boolean;
  installing: boolean;
  onSelectVersion: (version: string) => void;
  onInstall: () => void;
}

export interface ThemeMarketplaceGalleryProps {
  theme: MarketplaceTheme;
  adminTheme: string;
  screenshots: string[];
  activeImageIndex: number;
  onOpenLightbox: () => void;
  onSelectImage: (idx: number) => void;
}

export interface ThemeMarketplaceChangelogProps {
  theme: MarketplaceTheme;
  adminTheme: string;
}

export interface ThemeMarketplaceSidebarProps {
  theme: MarketplaceTheme;
  adminTheme: string;
  installedTheme: any | null;
  installedVersion: string | null;
  hasUpdate: boolean;
  installing: boolean;
  onInstall: () => void;
}

export interface ThemeMarketplaceVerifiedCardProps {
  adminTheme: string;
}
