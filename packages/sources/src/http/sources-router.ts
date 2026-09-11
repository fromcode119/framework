import { AccessLevel, BaseRouter } from '@fromcode119/core';
import type { Request, RequestHandler, Response } from 'express';
import { BuildService } from '@sources/build/build-service';
import { GitUrlPolicy } from '@sources/providers/git/git-url-policy';
import { SourceProviders } from '@sources/providers/source-providers';

/**
 * Express router for the Sources API endpoints.
 * Routes are mounted under the plugin's API namespace via context.api.
 * Every route except the health probe is admin-guarded — builds trigger code execution.
 */
export class SourcesRouter extends BaseRouter {
  constructor(
    private buildService: BuildService,
    private adminGuard: RequestHandler,
  ) {
    super();
  }

  protected registerRoutes(): void {
    // Mounted at `/sources`, so these are the paths under it. As a plugin they were `/sources/...`
    // beneath the plugin's own namespace, which mounted here would have read `/sources/sources`.
    //
    // ORDER IS LOAD-BEARING: every literal segment is declared before `/:slug`, or `/build` would be
    // matched as a source called "build".
    // What this installation can fetch source FROM. The form builds its provider field from this,
    // so adding a provider does not mean editing a dropdown in the admin.
    this.get('/providers', this.adminGuard, this.listProviders);
    this.post('/build', this.adminGuard, this.triggerAll);
    this.post('/check-updates', this.adminGuard, this.checkUpdates);
    // POST, not GET: the request carries a repository URL and possibly a token, and neither belongs
    // in a query string that lands in access logs.
    this.post('/branches', this.adminGuard, this.listBranches);
    this.post('/inspect', this.adminGuard, this.inspectSource);

    this.get('/', this.adminGuard, this.getStatus);
    this.post('/', this.adminGuard, this.createSource);
    this.get('/:slug', this.adminGuard, this.getStatusBySlug);
    this.patch('/:slug', this.adminGuard, this.updateSource);
    this.delete('/:slug', this.adminGuard, this.deleteSource);
    this.post('/:slug/build', this.adminGuard, this.triggerOne);
  }

  private async listProviders(_req: Request, res: Response): Promise<void> {
    res.json({ providers: SourceProviders.definitions(), success: true });
  }

  private async triggerAll(req: Request, res: Response): Promise<void> {
    console.log('[SourcesRouter] POST /trigger');
    try {
      const results = await this.buildService.buildAll();
      res.json({ success: true, results });
    } catch (err: any) {
      // 500, not 200. A failed build reported with a success status is indistinguishable from a
      // successful one to any non-browser consumer.
      res.status(500).json({ success: false, error: 'Build failed: ' + err.message });
    }
  }

  private async triggerOne(req: Request, res: Response): Promise<void> {
    const slug = String(req.params.slug ?? '');
    console.log(`[SourcesRouter] POST /trigger/${slug}`);
    try {
      const result = await this.buildService.buildBySlug(slug);
      res.status(result.success ? 200 : 500).json({ success: result.success, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Build failed: ' + err.message });
    }
  }

  private async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const builds = await this.buildService.getStatus();
      res.json({ builds });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch status: ' + err.message });
    }
  }

  private async getStatusBySlug(req: Request, res: Response): Promise<void> {
    try {
      const slug = String(req.params.slug ?? '');
      const build = await this.buildService.getStatusBySlug(slug);
      if (!build) {
        res.status(404).json({ error: `No build record for "${slug}"` });
        return;
      }
      res.json({ build });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch status: ' + err.message });
    }
  }

  private async deleteSource(req: Request, res: Response): Promise<void> {
    try {
      const slug = String(req.params.slug ?? '');
      await this.buildService.deleteSource(slug);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete source: ' + err.message });
    }
  }

  private async checkUpdates(req: Request, res: Response): Promise<void> {
    try {
      const updates = await this.buildService.checkForUpdates();
      const changed = updates.filter(u => u.hasUpdate);
      res.json({ total: updates.length, changed: changed.length, updates });
    } catch (err: any) {
      res.status(500).json({ error: 'Update check failed: ' + err.message });
    }
  }

  /**
   * The credential a remote-reading request should use.
   *
   * A freshly typed token wins, because the operator is replacing one. Otherwise, when the request
   * names a source that already exists, the token stored against it is used — the edit dialog posts
   * a blank token by design (the stored secret never leaves the server), and without this fallback
   * every read of a private repository failed the moment it was opened for editing.
   *
   * The URL is passed in rather than read here so the service can refuse to release a credential
   * for any repository other than the one it was stored against: slug and URL both come from the
   * caller, and trusting them to agree would turn this into a way to post somebody's token to a
   * host of your choosing. Changing the URL in the edit dialog therefore needs a fresh token, which
   * is the correct answer — it is a different repository.
   */
  private async resolveRequestToken(req: Request, gitUrl: string): Promise<string | undefined> {
    const posted = String(req.body?.gitSecret || '').trim();
    if (posted) return posted;
    const slug = String(req.body?.slug || '').trim();
    if (!slug) return undefined;
    return this.buildService.resolveStoredToken(slug, gitUrl);
  }

  /**
   * The branches of a repository the operator has typed in, so the branch field can offer what the
   * remote actually has instead of a free-text box defaulting to "main".
   *
   * An empty list is a valid answer — unreachable, private without a token, or genuinely no
   * branches — and the form says so rather than inventing a default.
   */
  private async listBranches(req: Request, res: Response): Promise<void> {
    const gitUrl = String(req.body?.gitUrl || '').trim();
    if (!gitUrl) {
      res.status(400).json({ error: 'A repository URL is required.' });
      return;
    }

    try {
      GitUrlPolicy.assertAllowed(gitUrl);
      const token = await this.resolveRequestToken(req, gitUrl);
      const branches = await this.buildService.listBranches(gitUrl, token);
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
  private async inspectSource(req: Request, res: Response): Promise<void> {
    const gitUrl = String(req.body?.gitUrl || '').trim();
    const branch = String(req.body?.branch || '').trim();
    if (!gitUrl || !branch) {
      res.status(400).json({ error: 'A repository URL and branch are required.' });
      return;
    }

    try {
      GitUrlPolicy.assertAllowed(gitUrl);
      const token = await this.resolveRequestToken(req, gitUrl);
      const declared = await this.buildService.inspectSource(gitUrl, branch, token);
      res.json({ declared, success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to read the repository.' });
    }
  }

  private async createSource(req: Request, res: Response): Promise<void> {
    try {
      const source = await this.buildService.createSource(req.body || {});
      res.status(201).json({ source, success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create source.' });
    }
  }

  private async updateSource(req: Request, res: Response): Promise<void> {
    try {
      const source = await this.buildService.updateSource(String(req.params.slug ?? ''), req.body || {});
      res.json({ source, success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update source.' });
    }
  }
}
