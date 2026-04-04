import { z } from 'zod';
import { PluginManifest, PluginCapability } from '../types';
import type { RegistryPlugin, RegistryManifest } from './manifest.types';

/**
 * Plugin Manifest Schema (Zod)
 * Defines the structure and validation rules for plugin.json files
 */
export const PluginManifestSchema = z.object({
  // Identity
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  namespace: z.string().regex(/^[a-z0-9.-]+$/, 'Namespace must be lowercase alphanumeric with dots or hyphens').optional(),
  name: z.string().min(1, 'Plugin name is required'),
  version: z.string().regex(
    /^\d+\.\d+\.\d+(-[\w.]+)?$/,
    'Version must be valid semver format (e.g., 1.2.3 or 1.2.3-beta.1)'
  ),

  // Metadata
  description: z.string().optional(),
  author: z.union([
    z.string(),
    z.object({
      name: z.string(),
      email: z.string().email().optional(),
      url: z.string().url().optional()
    })
  ]).optional(),
  license: z.string().optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),

  // Configuration & State
  enabled: z.boolean().default(true),
  category: z.string().optional().default('other'),
  tags: z.array(z.string()).optional().default([]),

  // Dependencies
  dependencies: z.record(z.string(), z.string()).optional().default({}),
  peerDependencies: z.record(z.string(), z.string()).optional().default({}),

  // Security & Capabilities
  capabilities: z.array(z.string()).optional().default([]),
  permissions: z.array(z.string()).optional().default([]),
  signature: z.string().optional(),
  checksum: z.string().optional(),

  // Custom Config
  config: z.record(z.any()).optional().default({}),

  // Admin UI & Extensions
  admin: z.object({
    group: z.string().optional(),
    groupStrategy: z.union([
      z.enum(['dropdown', 'section']),
      z.record(z.enum(['dropdown', 'section']))
    ]).optional(),
    icon: z.string().optional(),
    menu: z.array(z.any()).optional(),
    secondaryPanel: z.object({
      items: z.array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          path: z.string().regex(/^\/[A-Za-z0-9\-\/_]*$/, 'Secondary panel path must start with /'),
          sourcePaths: z.array(z.string().regex(/^\/[A-Za-z0-9\-\/_]*$/, 'Secondary panel source path must start with /')).optional(),
          icon: z.string().optional(),
          scope: z.enum(['self', 'plugin-target', 'global']).optional().default('self'),
          targetNamespace: z.string().regex(/^[a-z0-9.-]+$/, 'targetNamespace must be lowercase alphanumeric with dots or hyphens').optional(),
          targetPlugin: z.string().regex(/^[a-z0-9-]+$/, 'targetPlugin must be lowercase alphanumeric with hyphens').optional(),
          priority: z.number().int().optional(),
          requiredRoles: z.array(z.string()).optional(),
          requiredCapabilities: z.array(z.string()).optional(),
          group: z.string().optional(),
          description: z.string().optional(),
          sourceNamespace: z.string().optional(),
          sourcePlugin: z.string().optional(),
          allowGlobal: z.boolean().optional(),
          governanceKey: z.string().optional(),
        }).superRefine((item, ctx) => {
          if (item.scope === 'plugin-target') {
            if (!item.targetNamespace) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetNamespace'], message: 'targetNamespace is required for plugin-target scope' });
            }
            if (!item.targetPlugin) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetPlugin'], message: 'targetPlugin is required for plugin-target scope' });
            }
          }
          if (item.scope === 'global') {
            if (item.allowGlobal !== true) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['allowGlobal'], message: 'allowGlobal=true is required for global scope' });
            }
            if (!String(item.governanceKey || '').trim()) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['governanceKey'], message: 'governanceKey is required for global scope' });
            }
          }
        })
      ).optional()
    }).optional(),
    slots: z.array(z.object({
      slot: z.string(),
      component: z.string(),
      priority: z.number().optional()
    })).optional(),
    collections: z.array(z.any()).optional(),
    management: z.object({
      component: z.string().optional(),
      settings: z.array(z.any()).optional()
    }).optional()
  }).optional(),

  // Frontend build info
  frontend: z.object({
    entry: z.string().optional(),
    css: z.array(z.string()).optional(),
    assets: z.array(z.string()).optional(),
    headInjections: z.array(z.any()).optional()
  }).optional(),

  // Entry points
  entryPoint: z.string().optional(),
  frontendEntryPoint: z.string().optional(),

  // Database
  migrations: z.string().optional(),
  seeds: z.string().optional(),
  collections: z.union([z.array(z.string()), z.string()]).optional(),
}).passthrough();

/**
 * Registry Plugin Manifest Schema
 * Extended schema for plugins listed in the registry
 */
export const RegistryPluginSchema = PluginManifestSchema.extend({
  downloadUrl: z.string(),
  publicKey: z.string().optional(),
  screenshots: z.array(z.string().url()).optional().default([]),
  changelog: z.string().optional(),
  publisherId: z.string().optional(),
  published: z.boolean().default(true),
  downloads: z.number().int().min(0).optional().default(0),
  rating: z.number().min(0).max(5).optional(),
});


/**
 * Registry Manifest Schema
 * Schema for the main registry.json file
 */
export const RegistryManifestSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
  plugins: z.array(RegistryPluginSchema),
});


export class ManifestValidator {
  static validate(manifest: unknown): PluginManifest {
    return PluginManifestSchema.parse(manifest) as unknown as PluginManifest;
  }

  static safeValidate(manifest: unknown): { success: true; data: PluginManifest } | { success: false; errors: z.ZodIssue[] } {
    const result = PluginManifestSchema.safeParse(manifest);
    if (result.success) {
      return { success: true, data: result.data as unknown as PluginManifest };
    }
    return { success: false, errors: result.error.issues };
  }

  static validateRegistry(manifest: unknown): RegistryManifest {
    return RegistryManifestSchema.parse(manifest);
  }
}
