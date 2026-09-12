import type { IBuildSourceFormValues } from '@/app/sources/interfaces/build-source-form-values.interface';

export interface IBuildSourceFormState {
  /** Which provider fetches this source. */
  provider: string;
  /** What this installation can build, served with the providers so the list cannot drift. */
  types: Array<{ label: string; value: string }>;
  /** What this installation can fetch source from, as the server reported it. */
  providers: Array<{
    key: string;
    label: string;
    description: string;
    locationLabel: string;
    locationPlaceholder: string;
    refLabel: string;
    supportsSecret: boolean;
    secretLabel?: string;
  }>;
  autoBuild: boolean;
  autoUpdate: boolean;
  installAfterBuild: boolean;
  branch: string;
  /** Branch names the remote reported. Empty until a URL is entered, or when it cannot be read. */
  branches: string[];
  /** Whether a read has been ATTEMPTED, so the field never reports a result it has not got. */
  branchesAttempted: boolean;
  branchesLoading: boolean;
  /** Why branches could not be read, in the server's words. Empty when nothing went wrong. */
  branchFailure: string;
  /** True while the repository's own manifest is being read for its slug and type. */
  inspecting: boolean;
  /** Set when a repository was read but declared no extension, so the form can say so. */
  inspectFailed: boolean;
  gitSecret: string;
  gitUrl: string;
  slug: string;
  /**
   * The kind, DETECTED from the repository's manifest. One declaration, shared with the values the
   * form submits — it was spelled out separately here, and a union missing `appearance` is how a
   * correctly detected appearance could not even be held in state.
   */
  type: IBuildSourceFormValues['type'];
}
