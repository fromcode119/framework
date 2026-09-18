import { z } from 'zod';
import { RegistryPluginSchema } from '@core/management/registry-plugin-schema';

/**
 * Registry Manifest Schema
 * Schema for the main registry.json file
 */
export class RegistryManifestSchema {
  static readonly schema = z.object({
    version: z.string(),
    lastUpdated: z.string(),
    plugins: z.array(RegistryPluginSchema.schema),
  });
}
