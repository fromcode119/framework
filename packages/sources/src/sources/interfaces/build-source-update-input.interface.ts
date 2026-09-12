import { ExtensionScope } from '@fromcode119/core';

export interface IBuildSourceUpdateInput {
  branch?: string;
  gitSecret?: string;
  gitUrl?: string;
  type?: ExtensionScope;
  autoBuild?: boolean;
  /**
   * Replace an extension that is ALREADY installed with a newer build.
   *
   * A separate risk from installing one that is not there, so a separate switch: this is what
   * allows code currently serving a site to be swapped out.
   */
  autoUpdate?: boolean;
  /** Put each successful build in place when the extension is not installed yet. Defaults to on. */
  installAfterBuild?: boolean;
}
