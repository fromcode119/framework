import { FieldType, PluginCapability, MiddlewareStage } from './enums.enums';
import { Collection } from './schema.interfaces';

export interface MiddlewareConfig {
  id: string;
  priority?: number;
  stage: MiddlewareStage;
  handler: (req: any, res: any, next: (err?: any) => void) => void;
}

export interface ThemeManifest {
  slug: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  updateUrl?: string; // External URL to check for updates
  layouts: {
    name: string;
    label: string;
    description?: string;
  }[];
  slots?: string[]; // Defined slot names this theme provides
  overrides?: { name: string; component: string; priority?: number }[]; // Component overrides
  dependencies?: Record<string, string>; // Plugins required by this theme
  bundledPlugins?: string[]; // Relative paths to plugin .zip archives bundled inside the theme package
  seeds?: string; // Path to seed file
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
  runtimeModules?: Record<string, string | { keys?: string[], type?: 'icon' | 'lib', url?: string }>;
  ui: {
    entry: string;
    css?: string[];
  };
}

export interface MenuItemManifest {
  label: string;
  path: string;
  icon?: string;
  priority?: number;
  group?: string;
  children?: MenuItemManifest[];
}

export interface PluginManifest {
  // Identity
  slug: string;                    // Unique identifier
  namespace?: string;              // Vendor / registry namespace
  name: string;                    // Human-readable name
  version: string;                 // Semver version
  main?: string;                   // Entry point file (usually index.js)
  
  // Metadata
  description?: string;
  author?: string | { name: string; email?: string; url?: string };
  license?: string;
  homepage?: string;
  repository?: string;
  updateUrl?: string; // External URL to check for updates
  
  // Dependencies
  dependencies?: Record<string, string>; // pluginSlug -> semver
  peerDependencies?: Record<string, string>;
  
  // Capabilities & Permissions
  capabilities?: (PluginCapability | string)[];
  permissions?: string[];
  
  // Hooks & Extensions
  hooks?: any;
  api?: any;
  database?: any;
  
  // Migration & Installation
  migrations?: string;             // Path to migrations folder
  seeds?: string;                  // Path to seed data

  // Metadata for Admin UI
  admin?: {
    group?: string;
    groupStrategy?: 'dropdown' | 'section' | Record<string, 'dropdown' | 'section'>;
    icon?: string;
    menu?: MenuItemManifest[];
    slots?: { slot: string; component: string; priority?: number }[];
    collections?: Collection[];
    management?: {
      component?: string;
      settings?: {
        name: string;
        label: string;
        type: FieldType | string;
        description?: string;
        defaultValue?: any;
        options?: { label: string; value: any }[];
        placeholder?: string;
      }[];
    };
  };

  // Metadata for Frontend Theme
  theme?: {
    overrides?: { name: string; component: string; priority?: number }[];
    variables?: Record<string, string>;
    settings?: {
      name: string;
      label: string;
      type: FieldType;
      description?: string;
      defaultValue?: any;
    }[];
  };

  // UI build info
  ui?: {
    entry?: string; // e.g., "dist/index.js"
    css?: string[];
    assets?: string[];
    headInjections?: any[];
  };

  // Marketplace / Organization
  category: string;                // Flexible category string
  tags?: string[];
  enabled?: boolean;
  
  // Security
  signature?: string;              // Cryptographic signature
  checksum?: string;

  // Configuration
  config?: Record<string, any>;
  sandbox?: boolean | {
    // Sandbox is enabled by default. Set `sandbox: false` to disable isolation.
    memoryLimit?: number; // In MB
    timeout?: number;     // In ms
    allowNative?: boolean; // Advanced host bridge toggle for trusted plugins.
  };

  // Runtime Bridge configurations
  runtimeModules?: Record<string, string | { keys?: string[], type?: 'icon' | 'lib', url?: string }>;

  // Entry points
  entryPoint?: string;
  uiEntryPoint?: string;

  // Collections
  collections?: string[]; // Path to collections folder or list of slugs
}
