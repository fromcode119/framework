export interface Theme {
  slug: string;
  name: string;
  version: string;
  description?: string;
  state: 'active' | 'inactive';
  author?: string;
  variables?: Record<string, string>;
  variableSchema?: Record<string, {
    label: string;
    type: 'color' | 'text' | 'number' | 'select' | 'font' | 'image';
    description?: string;
    options?: { label: string; value: string }[];
    group?: string;
  }>;
  settingsDefaults?: Record<string, any>;
  settingsSchema?: Record<string, {
    label: string;
    type: 'text' | 'number' | 'boolean' | 'select' | 'integration' | 'json';
    description?: string;
    options?: { label: string; value: string }[];
    group?: string;
    placeholder?: string;
    integrationType?: string;
  }>;
  integrationRequirements?: {
    type: string;
    label?: string;
    description?: string;
    required?: boolean;
  }[];
  layouts?: { name: string; label: string; description?: string }[];
  overrides?: { name: string; component: string; priority?: number }[];
}

export interface ThemeSettingsPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[]>>;
}

export interface ThemeSettingsPageState {
  routeSlug: string;
  resolved: boolean;
  themeDetail: Theme | null;
  marketplaceVersion: string | null;
  loading: boolean;
  activeTab: 'overview' | 'settings';
  isUpdating: boolean;
  isSaving: boolean;
  isReseeding: boolean;
  isResettingTheme: boolean;
  isDeleting: boolean;
  isDeleteConfirmOpen: boolean;
  isRunSeedsConfirmOpen: boolean;
  isResetThemeConfirmOpen: boolean;
  dbConfig: any;
  tempVariables: Record<string, string>;
  tempLayouts: Record<string, string>;
  tempSettings: Record<string, any>;
}
