import { AuthManager } from '@fromcode119/auth';
import { PluginManager } from '@fromcode119/core';
import { UserManagementService } from '@api/services/user-management-service';
import { ScimService } from '@api/services/scim-service';

/**
 * SCIM 2.0 controller — thin HTTP orchestration over {@link ScimService}. Emits `application/scim+json`
 * and RFC-7644 error/response shapes so standard IdP SCIM clients interoperate unchanged.
 */
export class ScimController {
  private static readonly ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
  private static readonly SCIM_CONTENT_TYPE = 'application/scim+json';

  private readonly scim: ScimService;

  constructor(manager: PluginManager, auth: AuthManager) {
    this.scim = new ScimService(new UserManagementService((manager as any).db, auth, manager));
    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.create = this.create.bind(this);
    this.replace = this.replace.bind(this);
    this.patch = this.patch.bind(this);
    this.remove = this.remove.bind(this);
    this.serviceProviderConfig = this.serviceProviderConfig.bind(this);
  }

  async list(req: any, res: any): Promise<void> {
    const result = await this.scim.list(req.query?.filter);
    res.type(ScimController.SCIM_CONTENT_TYPE).json(result);
  }

  async get(req: any, res: any): Promise<void> {
    const user = await this.scim.get(String(req.params?.id));
    if (!user) { this.notFound(res, req.params?.id); return; }
    res.type(ScimController.SCIM_CONTENT_TYPE).json(user);
  }

  async create(req: any, res: any): Promise<void> {
    if (!req.body?.userName && !req.body?.emails?.length) { this.badRequest(res, 'userName is required'); return; }
    const user = await this.scim.create(req.body || {});
    res.status(201).type(ScimController.SCIM_CONTENT_TYPE).json(user);
  }

  async replace(req: any, res: any): Promise<void> {
    const user = await this.scim.replace(String(req.params?.id), req.body || {});
    if (!user) { this.notFound(res, req.params?.id); return; }
    res.type(ScimController.SCIM_CONTENT_TYPE).json(user);
  }

  async patch(req: any, res: any): Promise<void> {
    const user = await this.scim.patch(String(req.params?.id), req.body || {});
    if (!user) { this.notFound(res, req.params?.id); return; }
    res.type(ScimController.SCIM_CONTENT_TYPE).json(user);
  }

  async remove(req: any, res: any): Promise<void> {
    const ok = await this.scim.remove(String(req.params?.id));
    if (!ok) { this.notFound(res, req.params?.id); return; }
    res.status(204).end();
  }

  serviceProviderConfig(_req: any, res: any): void {
    res.type(ScimController.SCIM_CONTENT_TYPE).json({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      patch: { supported: true },
      filter: { supported: true, maxResults: 200 },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      changePassword: { supported: true },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [{ type: 'oauthbearertoken', name: 'OAuth Bearer Token', description: 'Authentication via the SCIM bearer token.' }],
    });
  }

  private notFound(res: any, id: unknown): void {
    res.status(404).type(ScimController.SCIM_CONTENT_TYPE).json({ schemas: [ScimController.ERROR_SCHEMA], status: '404', detail: `User ${id} not found` });
  }

  private badRequest(res: any, detail: string): void {
    res.status(400).type(ScimController.SCIM_CONTENT_TYPE).json({ schemas: [ScimController.ERROR_SCHEMA], status: '400', detail });
  }
}
