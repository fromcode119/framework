import { z } from 'zod';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import { PluginManifestSchema } from '@core/management/plugin-manifest-schema';
import { RegistryManifestSchema } from '@core/management/registry-manifest-schema';

export class ManifestValidator {
  static validate(manifest: unknown): IPluginManifest {
    return PluginManifestSchema.schema.parse(manifest) as unknown as IPluginManifest;
  }

  static safeValidate(manifest: unknown): { success: true; data: IPluginManifest } | { success: false; errors: z.ZodIssue[] } {
    const result = PluginManifestSchema.schema.safeParse(manifest);
    if (result.success) {
      return { success: true, data: result.data as unknown as IPluginManifest };
    }
    return { success: false, errors: result.error.issues };
  }

  static validateRegistry(manifest: unknown): z.infer<typeof RegistryManifestSchema.schema> {
    return RegistryManifestSchema.schema.parse(manifest);
  }
}
