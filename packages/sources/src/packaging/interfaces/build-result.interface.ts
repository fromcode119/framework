import { ExtensionScope } from '@fromcode119/core';

export interface IBuildResult {
  slug: string;
  type: ExtensionScope;
  success: boolean;
  version?: string;
  fileName?: string;
  error?: string;
  /** What changed in this version, for the admin to show before an operator updates. */
  changelog?: string;
}
