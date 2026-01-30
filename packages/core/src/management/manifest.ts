import { z } from 'zod';
import { PluginManifest, PluginCapability } from '../types';

/**
 * Plugin Manifest Schema (Zod)
 * Defines the structure and validation rules for plugin.json files
 */
export const PluginManifestSchema = z.object({
  // Identity
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
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
});

/**
 * Validates a plugin manifest object
 */
export function validatePluginManifest(manifest: unknown): PluginManifest {
  return PluginManifestSchema.parse(manifest) as unknown as PluginManifest;
}

/**
 * Safely validates a plugin manifest
 */
export function safeValidatePluginManifest(manifest: unknown): 
  { success: true; data: PluginManifest } | 
  { success: false; errors: z.ZodIssue[] } {
  const result = PluginManifestSchema.safeParse(manifest);
  
  if (result.success) {
    return { success: true, data: result.data as unknown as PluginManifest };
  } else {
    return { success: false, errors: result.error.issues };
  }
}

/**
 * Registry Plugin Manifest Schema
 * Extended schema for plugins listed in the registry
 */
export const RegistryPluginSchema = PluginManifestSchema.extend({
  downloadUrl: z.string(), // Supporting both relative and absolute URLs
  publicKey: z.string().optional(),
  screenshots: z.array(z.string().url()).optional().default([]),
  changelog: z.string().optional(),
  publisherId: z.string().optional(),
  published: z.boolean().default(true),
  downloads: z.number().int().min(0).optional().default(0),
  rating: z.number().min(0).max(5).optional(),
});

export type RegistryPlugin = z.infer<typeof RegistryPluginSchema>;

/**
 * Registry Manifest Schema
 * Schema for the main registry.json file
 */
export const RegistryManifestSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
  plugins: z.array(RegistryPluginSchema),
});

export type RegistryManifest = z.infer<typeof RegistryManifestSchema>;

/**
 * Validates a registry manifest
 * @param manifest - The registry manifest to validate
 * @returns Validated registry manifest
 */
export function validateRegistryManifest(manifest: unknown): RegistryManifest {
  return RegistryManifestSchema.parse(manifest);
}
