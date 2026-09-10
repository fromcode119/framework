import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';

/**
 * The `context.extensions` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextExtensions {
  installArchive(
    input: { filePath: string; type: ExtensionScope; enable?: boolean; activate?: boolean }
  ): Promise<any>;

  /**
   * Build one extension from a source directory.
   *
   * This lives here rather than being imported because a plugin may NOT import the builder:
   * `SdkBoundaryGuard` forbids any `@fromcode119/<not-sdk>` import from a plugin or theme, and
   * re-exporting the builder through the SDK would drag esbuild, vite, tailwind and terser into
   * every plugin's dependency graph. Core declares the contract; the api layer supplies the
   * implementation, so core never depends on the builder that depends on core.
   *
   * Never throws — a build failure is data, because the caller is usually rendering it to an
   * operator. `failedStep` names the step, so "the build broke" is never the whole story.
   */
  build(input: {
    sourceDir: string;
    kind: string;
    slug: string;
    pack?: boolean;
  }): Promise<{
    ok: boolean;
    failedStep?: string;
    message?: string;
    steps: Array<{ step: string; failed: boolean; skippedReason?: string }>;
  }>;

  /** Whether a builder is wired at all. False wherever the deployment ships no build toolchain. */
  isAvailable(): boolean;
}
