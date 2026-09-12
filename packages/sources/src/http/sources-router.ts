import { ExtensionScope } from '@fromcode119/core';
import { AccessLevel, BaseRouter } from '@fromcode119/core';
import type { Request, RequestHandler, Response } from 'express';
import { BuildService } from '@sources/packaging/build-service';
import { GitUrlPolicy } from '@sources/providers/git/git-url-policy';
import { SourceProviders } from '@sources/providers/source-providers';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';

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
    // ORDER IS LOAD-BEARING: every literal segment is declared before the parameterised routes, or
    // `/build` would be matched as a source called "build".
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
    // A source is addressed by KIND and slug, because that is what identifies it: the same slug can
    // name a plugin, a theme and an appearance, which are three different extensions in three
    // different roots. Addressed by slug alone, every one of these routes acted on whichever row
    // the database happened to return first.
    this.get('/:type/:slug', this.adminGuard, this.getStatusBySlug);
    this.patch('/:type/:slug', this.adminGuard, this.updateSource);
    this.delete('/:type/:slug', this.adminGuard, this.deleteSource);
    this.post('/:type/:slug/build', this.adminGuard, this.triggerOne);
    // The archive, made on request. A build no longer writes one — it stages a package directory —
    // so this is where "I want the file" is expressed. The admin used to link at
    // `/themes/<file>.zip`, a path nothing had served since Sources stopped being a plugin.
    this.get('/:type/:slug/package', this.adminGuard, this.downloadPackage);
  }

  /**
   * The source a request addresses, or a 404 when it addresses none.
   *
   * `ExtensionScope.find`, never `resolve`: `resolve` answers PLUGIN for anything it cannot name, so
   * a request to `/sources/bogus/tagiqx` would have deleted, built or downloaded the PLUGIN called
   * tagiqx. A path that names nothing must be a 404, not a different extension.
   */
  private identityFrom(req: Request, res: Response): BuildSourceIdentity | null {
    const identity = SourcesRouter.identityOrNull(req.params.type, req.params.slug);
    if (!identity) {
      res.status(404).json({
        success: false,
        error: `"${String(req.params.type ?? '')}/${String(req.params.slug ?? '')}" does not name a source.`,
      });
      return null;
    }
    return identity;
  }

  /** The same parse where the caller has its own answer for "no such source". */
  private static identityOrNull(type: unknown, slug: unknown): BuildSourceIdentity | null {
    try {
      return BuildSourceIdentity.parse(type, slug);
    } catch {
      return null;
    }
  }

  /**
   * Streams the built package as a zip, archiving the staged directory the first time it is asked
   * for and serving the same file afterwards.
   */
  private async downloadPackage(req: Request, res: Response): Promise<void> {
    const identity = this.identityFrom(req, res);
    if (!identity) return;

    try {
      const archive = await this.buildService.archivePackage(identity);
      if (!archive) {
        res.status(404).json({ success: false, error: `"${identity.key}" has no successful build to download.` });
        return;
      }
      res.download(archive.filePath, archive.fileName);
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Could not package this build: ' + err.message });
    }
  }

  private async listProviders(_req: Request, res: Response): Promise<void> {
    // The TYPES ride along with the providers: both answer "what can this installation build from,
    // and into what", both are derived rather than hand-listed, and the form asks once.
    res.json({ providers: SourceProviders.definitions(), types: ExtensionScope.definitions(), success: true });
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
    const identity = this.identityFrom(req, res);
    if (!identity) return;

    console.log(`[SourcesRouter] POST /trigger/${identity.key}`);
    try {
      const result = await this.buildService.buildSource(identity);
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
    const identity = this.identityFrom(req, res);
    if (!identity) return;

    try {
      const build = await this.buildService.getSourceStatus(identity);
      if (!build) {
        res.status(404).json({ error: `No build record for "${identity.key}"` });
        return;
      }
      res.json({ build });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch status: ' + err.message });
    }
  }

  private async deleteSource(req: Request, res: Response): Promise<void> {
    const identity = this.identityFrom(req, res);
    if (!identity) return;

    try {
      await this.buildService.deleteSource(identity);
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
    // Both halves, because the stored token belongs to one source and the slug names several.
    const identity = SourcesRouter.identityOrNull(req.body?.type, req.body?.slug);
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
    const identity = this.identityFrom(req, res);
    if (!identity) return;

    try {
      const source = await this.buildService.updateSource(identity, req.body || {});
      res.json({ source, success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update source.' });
    }
  }
}
