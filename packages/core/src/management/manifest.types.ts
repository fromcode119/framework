/** Type definitions for ManifestValidator */
import { z } from 'zod';
import type { RegistryPluginSchema, RegistryManifestSchema } from './manifest';

export type RegistryPlugin = z.infer<typeof RegistryPluginSchema>;
export type RegistryManifest = z.infer<typeof RegistryManifestSchema>;
