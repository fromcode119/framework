import { ExtensionBuildPipeline, ExtensionKind } from '@fromcode119/extension-builder';
import type { IExtensionBuildService } from '@fromcode119/core';

/**
 * Supplies `context.extensions.build(...)` to plugins.
 *
 * This class is the whole reason core stays free of a build toolchain. The builder depends on core,
 * so core cannot import the builder — the api layer, which already depends on both, registers the
 * implementation into core's `ExtensionBuildRegistry` at boot and the dependency stays one-way.
 */
export class ExtensionBuildService implements IExtensionBuildService {
  async build(input: { sourceDir: string; kind: string; slug: string; pack?: boolean }): Promise<{
    ok: boolean;
    failedStep?: string;
    message?: string;
    steps: Array<{ step: string; failed: boolean; skippedReason?: string }>;
  }> {
    let kind: ExtensionKind;
    try {
      kind = ExtensionKind.require(input.kind);
    } catch (error) {
      return { ok: false, failedStep: 'extension-kind', message: String(error), steps: [] };
    }

    const results = await ExtensionBuildPipeline.run({
      sourceDir: input.sourceDir,
      kind,
      slug: input.slug,
      pack: input.pack === true,
    });

    const steps = results.map((r) => ({ step: r.step, failed: r.failed, skippedReason: r.skippedReason }));
    const failure = results.find((r) => r.failed);

    // A failure is DATA, never an exception: the caller is usually rendering it to an operator, and
    // "the build broke" without the step name is the report that taught us to do this.
    return failure
      ? { ok: false, failedStep: failure.step, message: failure.message, steps }
      : { ok: true, steps };
  }
}
