import type { ComponentType } from 'react';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import type { IMenuItem } from '@react/interfaces/menu-item.interface';
import type { ICollectionMetadata } from '@react/interfaces/collection-metadata.interface';
import type { ISecondaryPanelState } from '@react/interfaces/secondary-panel-state.interface';
import type { IPluginApiSubscription } from '@react/interfaces/plugin-api-subscription.interface';

export interface IPluginContextValue {
  slots: Record<string, ISlotComponent[]>;
  overrides: Record<string, ISlotComponent>;
  themeVariables: Record<string, string>;
  themeLayouts: Record<string, any>;
  themeStyleVariants: Record<string, any>;
  activeTheme: any;
  menuItems: IMenuItem[];
  secondaryPanel: ISecondaryPanelState;
  collections: ICollectionMetadata[];
  fieldComponents: Record<string, ComponentType<any>>;
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
  registerPluginApi: (namespace: string, slug: string, api: any) => void;
  getPluginApi: (namespace: string, slug: string) => any;
  hasPluginApi: (namespace: string, slug: string) => boolean;
  /** Optional so external context-shaped stubs (e.g. theme null facades) stay valid. */
  pluginApiSubscription?: IPluginApiSubscription;
  setPluginState: (pluginSlug: string, key: string, value: any) => void;
  registerContentTransformer: (name: string, transform: (content: unknown, currentContent: unknown) => unknown, priority?: number) => void;
  registerSlotComponent: (slotName: string, component: any, pluginSlug?: string, priority?: number) => void;
  registerFieldComponent: (name: string, component: any) => void;
  registerOverride: (name: string, component: ISlotComponent) => void;
  registerMenuItem: (item: IMenuItem) => void;
  replaceMenuItems: (items: IMenuItem[]) => void;
  registerCollection: (collection: ICollectionMetadata) => void;
  replaceCollections: (collections: ICollectionMetadata[]) => void;
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
