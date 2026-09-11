import { GitSyncService } from '@sources/providers/git/git-sync-service';
import type { ISourceProvider } from '@sources/providers/interfaces/source-provider.interface';
import type { ISourceProviderDefinition } from '@sources/providers/interfaces/source-provider-definition.interface';
import type { ISourceRevision } from '@sources/providers/interfaces/source-revision.interface';

/**
 * Source from a git repository.
 *
 * The first provider, and for a long time the only assumption: everything above used to speak git
 * directly — `gitUrl`, `branch`, `gitSecret`, `git ls-remote`. This class is where that vocabulary
 * now stops. `GitSyncService` still does the work; this adapts it to the vocabulary every provider
 * shares, so a second one does not have to pretend to be a repository.
 */
export class GitSourceProvider implements ISourceProvider {
  static readonly KEY = 'git';

  /**
   * Static because a definition is what this provider IS, not something an instance computes.
   * Reading the list must never construct a provider: constructing this one creates its workspace
   * directory, so merely asking the admin what providers exist would have made one.
   */
  static readonly DEFINITION: ISourceProviderDefinition = {
    key: GitSourceProvider.KEY,
    label: 'Git repository',
    description: 'Clones a repository and builds the extension it contains.',
    locationLabel: 'Repository URL',
    locationPlaceholder: 'https://github.com/org/repo.git',
    refLabel: 'Branch',
    supportsSecret: true,
    secretLabel: 'Access token',
  };

  readonly definition = GitSourceProvider.DEFINITION;

  constructor(private readonly git: GitSyncService) {}

  listRefs(input: { location: string; secret?: string }): Promise<string[]> {
    return this.git.listBranches(input.location, input.secret);
  }

  headRevision(input: { location: string; ref: string; secret?: string }): Promise<string | null> {
    return this.git.getRemoteHeadSha(input.location, input.ref, input.secret);
  }

  async fetch(input: {
    location: string;
    ref: string;
    secret?: string;
    slug: string;
    kind: string;
  }): Promise<ISourceRevision> {
    const directory = await this.git.sync(input.location, input.ref, input.kind, input.slug, input.secret);
    return { directory, revision: await this.git.getLatestCommitSha(directory) };
  }

  inspect(input: { location: string; ref: string; secret?: string }): Promise<{
    slug: string;
    type: string;
    name: string;
    version: string;
  } | null> {
    return this.git.inspect(input.location, input.ref, input.secret);
  }

  changesSince(input: { directory: string; previousRevision: string }): Promise<string[]> {
    return this.git.changesSince(input.directory, input.previousRevision);
  }
}
