import { z } from 'zod';
import { PluginManifestSchema } from '@core/management/plugin-manifest-schema';

/**
 * Registry Plugin Manifest Schema
 * Extended schema for plugins listed in the registry
 */
export class RegistryPluginSchema {
  static readonly schema = PluginManifestSchema.schema.extend({
    downloadUrl: z.string(),
    publicKey: z.string().optional(),
    screenshots: z.array(z.string().url()).optional().default([]),
    changelog: z.string().optional(),
    publisherId: z.string().optional(),
    published: z.boolean().default(true),
    downloads: z.number().int().min(0).optional().default(0),
    rating: z.number().min(0).max(5).optional(),
  });
}
