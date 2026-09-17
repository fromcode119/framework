import type { Request, Response } from 'express';
import { BuildService } from '@sources/packaging/build-service';
import { GitUrlPolicy } from '@sources/providers/git/git-url-policy';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';

/**
 * Reading a repository the operator has typed in, BEFORE a source for it exists.
 *
 * These two endpoints are the only ones that take a URL from the request body rather than a stored
 * source, which is why they share a credential rule and live together: everything else in the
 * Sources API acts on a row that already exists.
 */
export class SourceRemoteProbeHandlers {
  constructor(private readonly buildService: BuildService) {}

  /**
   * The credential a remote-reading request should use.
   *
   * A freshly typed token wins, because the operator is replacing one. Otherwise, when the request
   * names a source that already exists, the token stored against it is used — the edit dialog posts
   * a blank token by design (the stored secret never leaves the server), and without this fallback
   * every read of a private repository failed the moment it was opened for editing.
   *
   * The URL is passed to the service rather than trusted here, so it can refuse to release a
   * credential for any repository other than the one it was stored against: slug and URL both come
   * from the caller, and trusting them to agree would turn this into a way to post somebody's token
   * to a host of your choosing. Changing the URL in the edit dialog therefore needs a fresh token,
   * which is the correct answer — it is a different repository.
   */
  private async token(req: Request, gitUrl: string): Promise<string | undefined> {
    const posted = String(req.body?.gitSecret || '').trim();
    if (posted) return posted;
    // Both halves, because the stored token belongs to one source and the slug names several.
    const identity = BuildSourceIdentity.parseOrNull(req.body?.type, req.body?.slug);
    if (!identity) return undefined;
    return this.buildService.resolveStoredToken(identity, gitUrl);
  }

  /**
   * The branches of a repository the operator has typed in, so the branch field can offer what the
   * remote actually has instead of a free-text box defaulting to "main".
   *
   * An empty list is a valid answer — unreachable, private without a token, or genuinely no
   * branches — and the form says so rather than inventing a default.
   */
  async listBranches(req: Request, res: Response): Promise<void> {
    const gitUrl = String(req.body?.gitUrl || '').trim();
    if (!gitUrl) {
      res.status(400).json({ error: 'A repository URL is required.' });
      return;
    }

    try {
      GitUrlPolicy.assertAllowed(gitUrl);
      const branches = await this.buildService.listBranches(gitUrl, await this.token(req, gitUrl));
      res.json({ branches, success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to read branches.' });
    }
  }

  /**
   * Reads a repository's own manifest so the form can state what it is rather than ask.
   *
   * `null` is a real answer — no manifest, unreadable, or a repository that is not an extension —
   * and the form reports it instead of filling the field with something plausible.
   */
  async inspectSource(req: Request, res: Response): Promise<void> {
    const gitUrl = String(req.body?.gitUrl || '').trim();
    const branch = String(req.body?.branch || '').trim();
    if (!gitUrl || !branch) {
      res.status(400).json({ error: 'A repository URL and branch are required.' });
      return;
    }

    try {
      GitUrlPolicy.assertAllowed(gitUrl);
      const declared = await this.buildService.inspectSource(gitUrl, branch, await this.token(req, gitUrl));
      res.json({ declared, success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to read the repository.' });
    }
  }
}
