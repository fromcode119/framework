import { CoercionUtils, ExtensionScope, RouteConstants } from '@fromcode119/core';
import { AccessLevel, BaseRouter } from '@fromcode119/core';
import type { Request, RequestHandler, Response } from 'express';
import { BuildService } from '@sources/packaging/build-service';
import { SourceProviders } from '@sources/providers/source-providers';
import { SourceRemoteProbeHandlers } from '@sources/http/source-remote-probe-handlers';
import { BuildSourceIdentity } from '@sources/sources/build-source-identity';

/**
 * Express router for the Sources API endpoints.
 * Routes are mounted under the plugin's API namespace via context.api.
 * Every route except the health probe is admin-guarded — builds trigger code execution.
 */
export class SourcesRouter extends BaseRouter {
  /** Reading a repository the request names, rather than one this installation already has. */
  private readonly probes: SourceRemoteProbeHandlers;

  constructor(
    private buildService: BuildService,
    private adminGuard: RequestHandler,
  ) {
    super();
    this.probes = new SourceRemoteProbeHandlers(buildService);
  }

  protected registerRoutes(): void {
    // Mounted at `/sources`, so these are the paths under it. As a plugin they were `/sources/...`
    // beneath the plugin's own namespace, which mounted here would have read `/sources/sources`.
    //
    // ORDER IS LOAD-BEARING: every literal segment is declared before the parameterised routes, or
    // `/build` would be matched as a source called "build".
    // What this installation can fetch source FROM. The form builds its provider field from this,
    // so adding a provider does not mean editing a dropdown in the admin.
    const S = RouteConstants.SEGMENTS;
    /** One source, by kind and slug — every per-source route hangs off this. */
    const ONE = S.SOURCES_ONE;

    this.get(S.SOURCES_PROVIDERS, this.adminGuard, this.listProviders);
    this.post(S.SOURCES_BUILD, this.adminGuard, this.triggerAll);
    this.post(S.SOURCES_CHECK_UPDATES, this.adminGuard, this.checkUpdates);
    // POST, not GET: the request carries a repository URL and possibly a token, and neither belongs
    // in a query string that lands in access logs.
    this.post(S.SOURCES_BRANCHES, this.adminGuard, (req, res) => this.probes.listBranches(req, res));
    this.post(S.SOURCES_INSPECT, this.adminGuard, (req, res) => this.probes.inspectSource(req, res));

    this.get(S.ROOT, this.adminGuard, this.getStatus);
    this.post(S.ROOT, this.adminGuard, this.createSource);
    // A source is addressed by KIND and slug, because that is what identifies it: the same slug can
    // name a plugin, a theme and an appearance, which are three different extensions in three
    // different roots. Addressed by slug alone, every one of these routes acted on whichever row
    // the database happened to return first.
    this.get(ONE, this.adminGuard, this.getStatusBySlug);
    this.patch(ONE, this.adminGuard, this.updateSource);
    this.delete(ONE, this.adminGuard, this.deleteSource);
    this.post(`${ONE}${S.SOURCES_BUILD}`, this.adminGuard, this.triggerOne);
    // The archive, made on request. A build no longer writes one — it stages a package directory —
    // so this is where "I want the file" is expressed. The admin used to link at
    // `/themes/<file>.zip`, a path nothing had served since Sources stopped being a plugin.
    this.get(`${ONE}${S.SOURCES_PACKAGE}`, this.adminGuard, this.downloadPackage);
    // What is running, what was last built, and every version still staged. Three facts from three
    // places — the screen could previously show only the middle one.
    this.get(`${ONE}${S.VERSIONS}`, this.adminGuard, this.listVersions);
    // Puts one of those staged versions in place. POST: it replaces code that is serving.
    this.post(`${ONE}${S.SOURCES_INSTALL}`, this.adminGuard, this.installVersion);
  }

  /**
   * The source a request addresses, or a 404 when it addresses none.
   *
   * `ExtensionScope.find`, never `resolve`: `resolve` answers PLUGIN for anything it cannot name, so
   * a request to `/sources/bogus/tagiqx` would have deleted, built or downloaded the PLUGIN called
   * tagiqx. A path that names nothing must be a 404, not a different extension.
   */
  private identityFrom(req: Request, res: Response): BuildSourceIdentity | null {
    const identity = BuildSourceIdentity.parseOrNull(req.params.type, req.params.slug);
    if (!identity) {
      res.status(404).json({
        success: false,
        error: `"${CoercionUtils.toString(req.params.type)}/${CoercionUtils.toString(req.params.slug)}" does not name a source.`,
      });
      return null;
    }
    return identity;
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

  private async listVersions(req: Request, res: Response): Promise<void> {
    const identity = this.identityFrom(req, res);
    if (!identity) return;

    try {
      res.json(await this.buildService.listVersions(identity));
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to read versions: ' + err.message });
    }
  }

  /**
   * Installs a named staged version.
   *
   * 400 rather than 500 when the version is unknown or absent: the request named something that is
   * not there, which is the caller's to correct, and the message says what IS there.
   */
  private async installVersion(req: Request, res: Response): Promise<void> {
    const identity = this.identityFrom(req, res);
    if (!identity) return;

    const version = CoercionUtils.toString((req.body as any)?.version).trim();
    if (!version) {
      res.status(400).json({ error: 'A version is required.' });
      return;
    }

    try {
      const result = await this.buildService.installVersion(identity, version);
      res.json({ ...result, ...(await this.buildService.listVersions(identity)) });
    } catch (err: any) {
      const message = String(err?.message || err);
      const unknownVersion = message.includes('is not staged') || message.includes('cannot be switched');
      res.status(unknownVersion ? 400 : 500).json({ error: message });
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
