import { GitSourceProvider } from '@sources/providers/git/git-source-provider';
import { GitSyncService } from '@sources/providers/git/git-sync-service';
import type { ISourceProvider } from '@sources/providers/interfaces/source-provider.interface';
import type { ISourceProviderDefinition } from '@sources/providers/interfaces/source-provider-definition.interface';

/**
 * THE list of source providers. The only file that names one.
 *
 * Everything else derives from it: the provider field's options, what a stored `provider` value is
 * allowed to be, and which implementation a build uses. Adding a second way to fetch source means
 * adding a folder under `providers/` and one line here — not a new branch in the build service, a
 * new option in the admin form, and a new column somewhere.
 *
 * The same shape finance uses for payment providers, for the same reason: the owner's rule is that
 * everything about one provider lives in one place, and adding the next one is adding a folder.
 */
export class SourceProviders {
  private static readonly DEFAULT_KEY = GitSourceProvider.KEY;

  /**
   * Builds every provider against a workspace.
   *
   * Constructed per install rather than held as singletons: a provider needs to know where it may
   * write, and that is a runtime setting an operator can change.
   */
  static all(workspaceSourceDir: string): ISourceProvider[] {
    return [new GitSourceProvider(new GitSyncService(workspaceSourceDir))];
  }

  /** What the admin offers. Reads the statics: constructing a provider is not free of side effects. */
  static definitions(): ISourceProviderDefinition[] {
    return [GitSourceProvider.DEFINITION];
  }

  /**
   * The provider a source is tracked with.
   *
   * An unknown key is NOT silently replaced with the default: a row that names a provider this build
   * does not have is a row whose source nobody can fetch, and building it with git "because that is
   * what we have" would clone something the operator never asked for. Null, and the caller says so.
   */
  static find(key: string, workspaceSourceDir: string): ISourceProvider | null {
    const needle = SourceProviders.normalize(key);
    return SourceProviders.all(workspaceSourceDir).find((p) => p.definition.key === needle) ?? null;
  }

  /**
   * The key to store for a source that names none.
   *
   * Every row predates the provider column, and all of them are git — that is a fact about the
   * history, not a guess, which is why this is a migration default and not a runtime fallback.
   */
  static defaultKey(): string {
    return SourceProviders.DEFAULT_KEY;
  }

  static normalize(key: unknown): string {
    return String(key ?? '').trim().toLowerCase() || SourceProviders.DEFAULT_KEY;
  }

}
