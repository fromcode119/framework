import express from 'express';
import { BaseRouter } from '@fromcode119/core';
import { AccessLevel, PluginManager } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { ScimController } from '@api/controllers/scim/scim-controller';
import { ScimTokenService } from '@api/services/scim-token-service';

/**
 * SCIM 2.0 provisioning router, mounted at `/scim/v2`. Authenticated by the SCIM BEARER TOKEN (not the
 * admin session) so an external IdP can call it — hence every route is `AccessLevel.PUBLIC` to the
 * framework session gate, then hard-gated by the token guard below (fail-closed: no configured token =
 * all provisioning rejected). Additive to auth; it never touches login or sessions.
 */
export class ScimRouter extends BaseRouter {
  private static readonly ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';

  private readonly controller: ScimController;
  private readonly tokens: ScimTokenService;

  constructor(manager: PluginManager, auth: AuthManager) {
    super();
    this.controller = new ScimController(manager, auth);
    this.tokens = new ScimTokenService((manager as any).db);
  }

  private guard = async (req: any, res: any, next: any): Promise<void> => {
    const header = String(req.headers?.authorization || '');
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (await this.tokens.matches(token)) { next(); return; }
    res.status(401).type('application/scim+json').json({ schemas: [ScimRouter.ERROR_SCHEMA], status: '401', detail: 'Invalid or missing SCIM bearer token' });
  };

  protected registerRoutes(): void {
    const pub = { access: AccessLevel.PUBLIC };
    // IdPs send `application/scim+json`, which the app's global `application/json` parser ignores —
    // parse any *+json (and plain json) body on the SCIM router so req.body is populated.
    this.use(express.json({ type: ['application/json', 'application/scim+json', 'application/*+json'] }));
    // Discovery — no auth (IdPs probe this before configuring credentials).
    this.get('/ServiceProviderConfig', pub, this.controller.serviceProviderConfig);
    // User provisioning — token-gated.
    this.get('/Users', pub, this.guard, this.controller.list);
    this.post('/Users', pub, this.guard, this.controller.create);
    this.get('/Users/:id', pub, this.guard, this.controller.get);
    this.put('/Users/:id', pub, this.guard, this.controller.replace);
    this.patch('/Users/:id', pub, this.guard, this.controller.patch);
    this.delete('/Users/:id', pub, this.guard, this.controller.remove);
  }
}
