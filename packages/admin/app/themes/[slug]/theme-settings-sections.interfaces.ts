import type { Theme } from './theme-settings-page.interfaces';

export interface ThemeSettingsHeaderProps {
  themeDetail: Theme;
  adminTheme: string;
  marketplaceVersion: string | null;
  activeTab: 'overview' | 'settings';
  isUpdating: boolean;
  isSaving: boolean;
  onUpdate: () => void;
  onSaveConfig: () => void;
}

export interface ThemeSettingsTabsProps {
  adminTheme: string;
  activeTab: 'overview' | 'settings';
  onTabChange: (tabId: 'overview' | 'settings') => void;
}

export interface ThemeOverviewCardProps {
  themeDetail: Theme;
  adminTheme: string;
  onActivate: () => void;
}

export interface ThemeVariableGroupsProps {
  themeDetail: Theme;
  adminTheme: string;
  groupedVariables: Record<string, string[]>;
  tempVariables: Record<string, string>;
  onVariableChange: (key: string, value: string) => void;
}

export interface ThemeLayoutMappingsProps {
  themeDetail: Theme;
  adminTheme: string;
  tempLayouts: Record<string, string>;
  onLayoutChange: (key: string, value: string) => void;
}

export interface ThemeOverridesCardProps {
  themeDetail: Theme;
  adminTheme: string;
}

export interface ThemeExtensionsCardProps {
  adminTheme: string;
  groupedThemeSettings: Record<string, string[]>;
  themeSettingsSchema: Record<string, any>;
  tempSettings: Record<string, any>;
  onSettingChange: (key: string, value: any) => void;
}

export interface ThemeSettingsSidebarProps {
  themeDetail: Theme;
  adminTheme: string;
  marketplaceVersion: string | null;
  isUpdating: boolean;
  isReseeding: boolean;
  isResettingTheme: boolean;
  previewPalette: {
    primary: string;
    background: string;
    foreground: string;
    muted: string;
    card: string;
    accent: string;
  };
  livePreviewUrl: string;
  integrationRequirements: { type: string; label?: string; description?: string; required?: boolean }[];
  onUpdate: () => void;
  onRunSeeds: () => void;
  onResetTheme: () => void;
  onDelete: () => void;
}
