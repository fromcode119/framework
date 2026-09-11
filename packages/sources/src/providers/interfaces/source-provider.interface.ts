import type { ISourceProviderDefinition } from '@sources/providers/interfaces/source-provider-definition.interface';
import type { ISourceRevision } from '@sources/providers/interfaces/source-revision.interface';

/**
 * Where an extension's source comes FROM.
 *
 * Git is the only provider today, and that was the whole problem: git was not a choice this code
 * made, it was an assumption spread through it — `gitUrl`, `branch`, `gitSecret`, a service that
 * shells out to `git`, and an admin form that asked for a repository URL. Adding a second way to
 * fetch source (an archive URL, a registry tarball, a directory on disk) meant touching all of it.
 *
 * A provider answers four questions, and nothing above this interface knows how:
 *   - what do you need configured, and what do you call it  (`definition`)
 *   - what versions can I track                             (`listRefs`)
 *   - what is the newest revision right now                 (`headRevision`)
 *   - put that revision on disk for me                      (`fetch`)
 *
 * `ref` is deliberately not called `branch`. A branch is git's word; a provider that tracks releases
 * or tags or "latest" answers with those, and the admin shows what the provider actually returned
 * rather than a field named for one implementation.
 */
export interface ISourceProvider {
  readonly definition: ISourceProviderDefinition;

  /**
   * The refs this source could track, for the field that asks which one.
   *
   * An empty list is a real answer — unreachable, private without a credential, or genuinely empty —
   * and the caller says so rather than inventing a default.
   */
  listRefs(input: { location: string; secret?: string }): Promise<string[]>;

  /** The newest revision of `ref`, without fetching it. Null when it cannot be determined. */
  headRevision(input: { location: string; ref: string; secret?: string }): Promise<string | null>;

  /** Places the source on disk and reports what landed there. */
  fetch(input: {
    location: string;
    ref: string;
    secret?: string;
    slug: string;
    kind: string;
  }): Promise<ISourceRevision>;

  /**
   * What the source declares itself to be — slug, kind, name, version — read from its own manifest.
   *
   * Null when it declares nothing, which the form reports instead of guessing from the location: a
   * repository called `plugin-forms` may ship anything.
   */
  inspect(input: { location: string; ref: string; secret?: string }): Promise<{
    slug: string;
    type: string;
    name: string;
    version: string;
  } | null>;

  /** The changes between two revisions, newest first. Empty when there is nothing to report. */
  changesSince(input: { directory: string; previousRevision: string }): Promise<string[]>;
}
