import React from 'react';

export interface SlotComponent {
  component: React.ComponentType<any>;
  priority: number;
  pluginSlug: string;
}

export interface MenuItem {
  label: string;
  path: string;
  icon?: string;
  priority?: number;
  pluginSlug: string;
  group?: string;
  children?: MenuItem[];
}

export interface CollectionMetadata {
  slug: string;
  shortSlug?: string;
  unprefixedSlug?: string;
  pluginSlug?: string;
  name?: string;
  fields: any[];
  admin?: any;
}

export interface SecondaryPanelItem {
  canonicalId: string;
  id: string;
  label: string;
  path: string;
  sourcePaths: string[];
  icon?: string;
  scope: string;
  sourceNamespace: string;
  sourcePlugin: string;
  sourceCanonicalKey: string;
  targetNamespace: string;
  targetPlugin: string;
  targetCanonicalKey: string;
  priority: number;
  group?: string;
  description?: string;
  requiredRoles: string[];
  requiredCapabilities: string[];
}

export interface SecondaryPanelContext {
  id: string;
  label: string;
  targetNamespace: string;
  targetPlugin: string;
  targetCanonicalKey: string;
}

export interface SecondaryPanelState {
  version: number;
  contexts: Record<string, SecondaryPanelContext>;
  itemsByContext: Record<string, SecondaryPanelItem[]>;
  globalItems: SecondaryPanelItem[];
  policy: {
    allowlistKey: string;
    allowlistEntries: number;
    evaluatedAt: string;
  };
  precedence: {
    scopeOrder: string[];
    tieBreakOrder: string[];
  };
}

export interface PluginContextValue {
  slots: Record<string, SlotComponent[]>;
  overrides: Record<string, SlotComponent>;
  themeVariables: Record<string, string>;
  themeLayouts: Record<string, any>;
  activeTheme: any;
  menuItems: MenuItem[];
  secondaryPanel: SecondaryPanelState;
  collections: CollectionMetadata[];
  fieldComponents: Record<string, React.ComponentType<any>>;
  plugins: any[];
  settings: Record<string, any>;
  pluginState: Record<string, Record<string, any>>;
  translations: Record<string, any>;
  locale: string;
  refreshVersion: number;
  isReady: boolean;
  triggerRefresh: () => void;
  setLocale: (locale: string) => void;
  t: (key: string, params?: Record<string, any>, defaultValue?: string) => string;
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (data: any) => void) => () => void;
  registerAPI: (slug: string, api: any) => void;
  getAPI: (slug: string) => any;
  registerPluginApi: (namespace: string, slug: string, api: any) => void;
  getPluginApi: (namespace: string, slug: string) => any;
  hasPluginApi: (namespace: string, slug: string) => boolean;
  setPluginState: (pluginSlug: string, key: string, value: any) => void;
  registerSlotComponent: (slotName: string, component: any, pluginSlug?: string, priority?: number) => void;
  registerFieldComponent: (name: string, component: any) => void;
  registerOverride: (name: string, component: SlotComponent) => void;
  registerMenuItem: (item: MenuItem) => void;
  replaceMenuItems: (items: MenuItem[]) => void;
  registerCollection: (collection: CollectionMetadata) => void;
  replaceCollections: (collections: CollectionMetadata[]) => void;
  registerPlugins: (plugins: any[]) => void;
  registerTheme: (slug: string, config: any) => void;
  registerSettings: (settings: Record<string, any>) => void;
  loadConfig: (path?: string) => Promise<void>;
  getFrontendMetadata: (options?: { ensureLoaded?: boolean }) => Promise<any>;
  resolveContent: (slug: string) => Promise<{ type: string; doc: any; plugin: string } | null>;
  api: {
    get: (path: string, options?: any) => Promise<any>;
    post: (path: string, body?: any, options?: any) => Promise<any>;
    put: (path: string, body?: any, options?: any) => Promise<any>;
    patch: (path: string, body?: any, options?: any) => Promise<any>;
    delete: (path: string, options?: any) => Promise<any>;
    getBaseUrl?: () => string;
  };
}
