import { ExtensionBuildPipeline, ExtensionKind } from '@fromcode119/extension-builder';
import type { IThemeBuilder } from '@fromcode119/core';

/**
 * Compiles a theme in place with the same pipeline `atlantis build theme` runs, so a theme the platform
 * scaffolds is built exactly like one a developer builds. Rejects with the failed step's own message.
 */
export class ExtensionThemeBuilder implements IThemeBuilder {
  async build(sourceDir: string, slug: string): Promise<void> {
    const steps = await ExtensionBuildPipeline.run({ sourceDir, kind: ExtensionKind.require('theme'), slug, pack: false });
    const failed = steps.find((step) => step.failed);
    if (failed) throw new Error(`Build failed at ${failed.step}: ${failed.message ?? 'no detail'}`);
  }
}
