import { Request, Response } from 'express';
import { ArchiveUploadSessionService, BaseController, CoercionUtils, Logger } from '@fromcode119/core';
import { TenantAdminService } from '@api/services/tenants/tenant-admin-service';

/**
 * HTTP for the Sites admin. Thin: validates the shape of the request, hands it to
 * `TenantAdminService`, maps failures to a status. Every route it serves sits behind
 * `auth.guard(['admin'])` AND `PlatformAdminGuard` in the router.
 *
 * Archives arrive through the same chunked upload session the plugin/theme/backup uploads use;
 * `preview` and `execute` take the session id, not a file.
 */
export class TenantAdminController extends BaseController {
  private static readonly ARCHIVE_EXTENSIONS = ['.tar.gz', '.tgz'];
  private readonly logger = new Logger({ namespace: 'tenant-admin' });

  constructor(private readonly service: TenantAdminService) {
    super();
  }

  async list(_req: Request, res: Response): Promise<void> {
    try {
      const tenants = await this.service.list();
      res.json({ multiTenant: this.service.multiTenant, tenants: tenants.map((tenant) => tenant.toJSON()), installed: this.service.installed() });
    } catch (error) {
      this.fail(res, error);
    }
  }

  async get(req: Request, res: Response): Promise<void> {
    try {
      res.json((await this.service.get(CoercionUtils.toString(req.params.id))).toJSON());
    } catch (error) {
      this.fail(res, error);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      res.status(201).json((await this.service.create(TenantAdminController.body(req), this.actor(req))).toJSON());
    } catch (error) {
      this.fail(res, error);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      res.json((await this.service.update(CoercionUtils.toString(req.params.id), TenantAdminController.body(req), this.actor(req))).toJSON());
    } catch (error) {
      this.fail(res, error);
    }
  }

  async addMember(req: Request, res: Response): Promise<void> {
    try {
      const body = TenantAdminController.body(req);
      const roles = Array.isArray(body.roles) ? body.roles.map((role) => CoercionUtils.toString(role)) : [];
      await this.service.addMember(CoercionUtils.toString(req.params.id), CoercionUtils.toString(body.email), roles);
      res.status(201).json((await this.service.get(CoercionUtils.toString(req.params.id))).toJSON());
    } catch (error) {
      this.fail(res, error);
    }
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      await this.service.removeMember(CoercionUtils.toString(req.params.id), CoercionUtils.toString(req.params.userId));
      res.json((await this.service.get(CoercionUtils.toString(req.params.id))).toJSON());
    } catch (error) {
      this.fail(res, error);
    }
  }

  async materializePages(req: Request, res: Response): Promise<void> {
    try {
      res.json(await this.service.materializePages(CoercionUtils.toString(req.params.id)));
    } catch (error) {
      this.fail(res, error);
    }
  }

  async exportTenant(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.service.exportTenant(CoercionUtils.toString(req.params.id), this.actor(req));
      res.status(201).json({ backup: result.backup, manifest: result.manifest });
    } catch (error) {
      this.fail(res, error);
    }
  }

  async deleteTenant(req: Request, res: Response): Promise<void> {
    try {
      const body = TenantAdminController.body(req);
      res.json(await this.service.deleteTenant(CoercionUtils.toString(req.params.id), CoercionUtils.toString(body.confirmSlug), this.actor(req)));
    } catch (error) {
      this.fail(res, error);
    }
  }

  async startImportSession(req: Request, res: Response): Promise<void> {
    try {
      const body = TenantAdminController.body(req);
      const session = ArchiveUploadSessionService.startSession(
        CoercionUtils.toString(body.originalFilename), CoercionUtils.toNumber(body.totalSizeBytes), CoercionUtils.toNumber(body.totalChunks),
        TenantAdminController.ARCHIVE_EXTENSIONS,
      );
      res.status(201).json(session);
    } catch (error) {
      this.fail(res, error);
    }
  }

  async uploadImportChunk(req: Request, res: Response): Promise<void> {
    try {
      const body = TenantAdminController.body(req);
      const filePath = CoercionUtils.toString((req as Request & { file?: { path?: unknown } }).file?.path).trim();
      if (!filePath) throw new Error('chunk file is required.');
      res.status(201).json(ArchiveUploadSessionService.appendChunk(
        CoercionUtils.toString(body.uploadId), filePath, CoercionUtils.toNumber(body.chunkIndex), CoercionUtils.toNumber(body.totalChunks),
      ));
    } catch (error) {
      this.fail(res, error);
    }
  }

  async previewImport(req: Request, res: Response): Promise<void> {
    try {
      const body = TenantAdminController.body(req);
      const upload = ArchiveUploadSessionService.resolveUploadedArchive(CoercionUtils.toString(body.uploadId));
      const plan = await this.service.previewImport(upload.filePath, TenantAdminController.identity(body));
      res.json({ ...plan.toJSON(), archive: upload.originalFilename });
    } catch (error) {
      this.fail(res, error);
    }
  }

  async executeImport(req: Request, res: Response): Promise<void> {
    try {
      const body = TenantAdminController.body(req);
      const uploadId = CoercionUtils.toString(body.uploadId);
      const upload = ArchiveUploadSessionService.resolveUploadedArchive(uploadId);
      const result = await this.service.executeImport(upload.filePath, TenantAdminController.identity(body), this.actor(req));
      ArchiveUploadSessionService.discardSession(uploadId);
      res.status(201).json(result.toJSON());
    } catch (error) {
      this.fail(res, error);
    }
  }

  async adopt(req: Request, res: Response): Promise<void> {
    try {
      res.status(201).json(await this.service.adopt(TenantAdminController.identity(TenantAdminController.body(req)), this.actor(req)));
    } catch (error) {
      this.fail(res, error);
    }
  }

  private static body(req: Request): Record<string, unknown> {
    return (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  }

  private static identity(body: Record<string, unknown>): Record<string, unknown> {
    const tenant = (body.tenant && typeof body.tenant === 'object' ? body.tenant : body) as Record<string, unknown>;
    return { id: tenant.id, slug: tenant.slug, primaryHost: tenant.primaryHost, hostAliases: tenant.hostAliases, state: tenant.state };
  }

  private actor(req: Request): Record<string, unknown> {
    const user = (req as Request & { user?: { id?: unknown; email?: unknown } }).user;
    return { userId: user?.id ?? null, email: user?.email ?? null };
  }

  private fail(res: Response, error: unknown): void {
    const message = error instanceof Error ? error.message : 'Tenant operation failed.';
    const status = CoercionUtils.toNumber((error as { statusCode?: unknown })?.statusCode) || TenantAdminController.statusFor(message);
    if (status >= 500) this.logger.error(message, error);
    res.status(status).json({ error: message });
  }

  private static statusFor(message: string): number {
    if (/not found/i.test(message)) return 404;
    if (/already (exists|routes)|confirm|refus/i.test(message)) return 409;
    if (/required|must be|not (a valid|one of|supported)|is not a/i.test(message)) return 400;
    return 500;
  }
}
