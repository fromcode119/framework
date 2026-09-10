/**
 * What the api layer registers into {@link ExtensionBuildRegistry} — the BUILD half of
 * `context.extensions`, and nothing else.
 *
 * Deliberately narrower than `IPluginContextExtensions`: installing an archive is core's own job
 * and needs no toolchain, whereas building needs esbuild/vite/tailwind and therefore lives outside
 * core. Making the registry hold the full surface would force whoever supplies a builder to also
 * reimplement `installArchive`.
 */
export interface IExtensionBuildService {
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
}
