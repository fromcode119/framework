import React from 'react';

export interface GlobalStubSetupArgs {
  ReactRef: typeof React;
  ReactDOMRef: any;
  FrameworkIcons: any;
  FrameworkIconRegistry: any;
  getIcon: (name: string) => any;
  IconNames: any;
  createProxyIcon: (...args: any[]) => any;
}

export interface RuntimeBridgeInstallArgs {
  apiUrl?: string;
  registerContentTransformer: (...args: any[]) => void;
  registerSlotComponent: (...args: any[]) => void;
  registerFieldComponent: (...args: any[]) => void;
  registerOverride: (...args: any[]) => void;
  registerMenuItem: (...args: any[]) => void;
  replaceMenuItems: (...args: any[]) => void;
  registerCollection: (...args: any[]) => void;
  replaceCollections: (...args: any[]) => void;
  registerPlugins: (...args: any[]) => void;
  registerTheme: (...args: any[]) => void;
  registerSettings: (...args: any[]) => void;
  registerPluginApi: (...args: any[]) => void;
  getPluginApi: (...args: any[]) => any;
  hasPluginApi: (...args: any[]) => boolean;
  setPluginState: (...args: any[]) => void;
  stableLoadConfig: (...args: any[]) => Promise<any>;
  stableGetFrontendMetadata: (...args: any[]) => Promise<any>;
  emit: (...args: any[]) => void;
  on: (...args: any[]) => any;
  stableT: (...args: any[]) => any;
  stableApiBridge: Record<string, any>;
  setLocale: (...args: any[]) => void;
  usePlugins: (...args: any[]) => any;
  useTranslation: (...args: any[]) => any;
  usePluginState: (...args: any[]) => any;
  useSystemShortcodes: (...args: any[]) => any;
  CollectionQueryUtils: any;
  BrowserLocalization: any;
  LocalizationUtils: any;
  RelationUtils: any;
  CoercionUtils: any;
  StringUtils: any;
  NumberUtils: any;
  FormatUtils: any;
  ApiVersionUtils: any;
  CollectionUtils: any;
  PaginationUtils: any;
  HookEventUtils: any;
  isReady: boolean;
  PluginsProvider: any;
  RuntimeConstants: any;
  getIcon: (name: string) => any;
  FrameworkIconRegistry: any;
  FrameworkIcons: any;
  IconNames: any;
  createProxyIcon: (...args: any[]) => any;
  RootFramework: any;
  Slot: any;
  Override: any;
  ReactRef: typeof React;
  ReactDOMRef: any;
  runtimeModules?: Record<string, any>;
  stabilityRef: React.MutableRefObject<any>;
}
