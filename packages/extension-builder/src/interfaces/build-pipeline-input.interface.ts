import type { ExtensionKind } from '@extension-builder/extension-kind';

/** The inputs a single build/pack run takes. Shared by `ExtensionBuildPipeline.run` and `runSteps`. */
export interface IBuildPipelineInput {
  sourceDir: string;
  kind: ExtensionKind;
  slug: string;
  pack: boolean;
  packDir?: string;
  /**
   * Whether the staged package is also written out as an archive. Defaults to true.
   *
   * `pack` was doing two jobs: staging a cleaned, closured, correctly-stamped copy, and tarring
   * it. Only the second is about archives, and the server wants the first on its own — it
   * installs from the directory. Splitting them is what stops the server path from skipping the
   * packaging in order to skip the tarball.
   */
  archive?: boolean;
}
