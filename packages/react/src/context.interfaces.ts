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

export interface PluginContextValue {
  slots: Record<string, SlotComponent[]>;
  overrides: Record<string, SlotComponent>;
  themeVariables: Record<string, string>;
  themeLayouts: Record<string, any>;
  activeTheme: any;
  menuItems: MenuItem[];
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
  setPluginState: (pluginSlug: string, key: string, value: any) => void;
  registerSlotComponent: (slotName: string, component: any, pluginSlug?: string, priority?: number) => void;
  registerFieldComponent: (name: string, component: any) => void;
  registerOverride: (name: string, component: SlotComponent) => void;
  registerMenuItem: (item: MenuItem) => void;
  registerCollection: (collection: CollectionMetadata) => void;
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