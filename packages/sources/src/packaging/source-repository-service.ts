import { BuildSourceIdentity } from '@sources/sources/build-source-identity';
import { ExtensionScope } from '@fromcode119/core';
import { SourceProviders } from '@sources/providers/source-providers';
import type { ISourceProvider } from '@sources/providers/interfaces/source-provider.interface';
import { BuildSourceService } from '@sources/sources/build-source-service';

/**
 * Questions answered by the REMOTE repository rather than by anything already built: its branches,
 * what a checkout contains, and the credential to reach it with.
 *
 * A stored token is only ever returned for the SAME repository it was stored against — comparing the
 * normalised URL, not the source's name. A source repointed at a different remote must not carry the
 * old remote's credential to the new one, and a name is not identity.
 *
 * Split out of `BuildService` (494 lines). Everything here talks to a provider; nothing here reads
 * or writes a built artifact.
 */
export class SourceRepositoryService {
  constructor(
    private readonly providers: (key: string) => ISourceProvider | null,
    private readonly buildSourceService: BuildSourceService,
  ) {}

  /**
   * The token stored against an existing source, for a form that is EDITING one.
   *
   * The stored secret is never sent to the browser, so the edit dialog posts a blank token. Without
   * this, reading a private repository's branches failed for want of credentials the server already
   * had, and the field said "No branches could be read" — a statement about the repository for what
   * was really a statement about the request.
   *
   * The token is released ONLY for the repository it was stored against. A caller chooses both the
   * slug and the URL, so without that check "read the branches of <attacker's host>, as source
   * <yours>" would hand somebody else's host a working credential — the stored secret would leave
   * the server after all, just not through the field that refuses to show it.
   */
  async resolveStoredToken(identity: BuildSourceIdentity, gitUrl: string): Promise<string | undefined> {
    const entry = await this.buildSourceService.getRawSource(identity);
    if (!entry?.gitSecret) return undefined;
    return SourceRepositoryService.sameRepository(entry.gitUrl, gitUrl) ? entry.gitSecret : undefined;
  }

  /**
   * Whether two URLs name the same repository, for the purpose of releasing a credential.
   *
   * Deliberately strict: case and a trailing slash or `.git` are noise git itself ignores, and
   * nothing else is forgiven. A looser comparison here is a credential leak, so anything it cannot
   * prove identical is treated as a different repository.
   */
  private static sameRepository(stored: string, requested: string): boolean {
    // Trailing slashes come off FIRST: "repo.git/" must reach "repo", and stripping `.git` before
    // the slash leaves "repo.git", which then matches nothing.
    const normalize = (value: string): string =>
      String(value || '').trim().toLowerCase().replace(/\/+$/, '').replace(/\.git$/, '').replace(/\/+$/, '');
    const left = normalize(stored);
    return left.length > 0 && left === normalize(requested);
  }

  async listBranches(gitUrl: string, token?: string): Promise<string[]> {
    const provider = this.providers(SourceProviders.defaultKey());
    return provider ? provider.listRefs({ location: gitUrl, secret: token }) : [];
  }

  /** What the repository declares itself to be — slug and type — so the form never asks for them. */
  async inspectSource(gitUrl: string, branch: string, token?: string): Promise<Record<string, unknown> | null> {
    const provider = this.providers(SourceProviders.defaultKey());
    return provider ? provider.inspect({ location: gitUrl, ref: branch, secret: token }) : null;
  }

  resolveSourceDirectory(type: ExtensionScope): string {
    if (type === ExtensionScope.CORE) {
      return 'core';
    }
    if (type === ExtensionScope.APPEARANCE) {
      return 'appearances';
    }
    return type === ExtensionScope.THEME ? 'themes' : 'plugins';
  }
}
