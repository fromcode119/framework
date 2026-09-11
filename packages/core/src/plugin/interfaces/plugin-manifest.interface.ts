import { NavGroupStrategy } from '@core/enums/nav-group-strategy.enum';
import { RuntimeModuleKind } from '@core/plugin/services/enums/runtime-module-kind.enum';
import { FieldType } from '@core/enums/field-type.enum';
import { ICollection } from '@core/collections/interfaces/collection.interface';

import type { IMenuItemManifest } from '@core/interfaces/menu-item-manifest.interface';
import type { ISecondaryPanelManifest } from '@core/interfaces/secondary-panel-manifest.interface';
import type { IPublicRouteManifest } from '@core/interfaces/public-route-manifest.interface';

export interface IPluginManifest {
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
  /**
   * Declared capabilities, as they appear in `manifest.json` — i.e. STRINGS.
   *
   * `PluginCapability` is the framework's vocabulary for these values, not the wire type: a manifest is
   * JSON, so nothing here is ever an enum member at runtime. Typing this `(PluginCapability | string)[]`
   * made every consumer handle a member that can never arrive; compare against `PluginCapability.X.value`
   * instead.
   */
  capabilities?: string[];
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
    /** Short display name for the dropdown entry. Falls back to manifest.name then group. */
    label?: string;
    groupStrategy?: NavGroupStrategy | Record<string, 'dropdown' | 'section'>;
    icon?: string;
    menu?: IMenuItemManifest[];
    secondaryPanel?: ISecondaryPanelManifest;
    slots?: { slot: string; component: string; priority?: number }[];
    collections?: ICollection[];
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
    /**
     * Stylesheets for the ADMIN only. Separate from `css`, which both the admin and the storefront
     * mount: the compiled admin-UI utilities are meaningless on a public page and were downloading
     * ~79KB gzipped of admin CSS onto every storefront request when they shared one key. Mirrors the
     * `entry` / `frontendEntry` split that already separates the two bundles.
     */
    adminCss?: string[];
    assets?: string[];
    headInjections?: any[];
    publicRoutes?: IPublicRouteManifest[];
    // Head-data provider contract: the plugin's own API path serving resolved head data,
    // plus the record field names it wants forwarded from the resolved content record.
    // The framework forwards declared fields opaquely — it never knows what they mean.
    headDataPath?: string;
    headDataRecordFields?: string[];
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

  /**
   * Set by the framework, never by a manifest on disk: this extension was found in the BUNDLED
   * root, so it ships inside the image. Bundled extensions are always active and can be neither
   * disabled nor removed — they are product surface, not an operator's installation.
   */
  bundled?: boolean;
  /**
   * T5: `false` (or `{ enabled: false }`) keeps the plugin in the api process ("shared") — give a `reason`,
   * the admin shows it. `{ enabled: true }` isolates it even when the platform default is shared.
   */
  sandbox?: boolean | {
    reason?: string;
    // Sandbox is enabled by default. Set `sandbox: false` to disable isolation.
    memoryLimit?: number; // In MB
    timeout?: number;     // In ms
    allowNative?: boolean; // Advanced host bridge toggle for trusted plugins.
  };

  // Runtime Bridge configurations
  runtimeModules?: Record<string, string | { keys?: string[], type?: RuntimeModuleKind, url?: string }>;

  // Entry points
  entryPoint?: string;
  uiEntryPoint?: string;

  // Collections
  collections?: string[]; // Path to collections folder or list of slugs
}
