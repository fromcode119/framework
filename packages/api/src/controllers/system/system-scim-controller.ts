import { Request, Response } from 'express';
import { ApiVersionUtils, RouteConstants } from '@fromcode119/core';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';
import { ScimTokenService } from '@api/services/scim-token-service';

/**
 * SCIM provisioning endpoints: the tenant base URL and the bearer token that identity providers use.
 *
 * Split out of SystemAdminController (531 lines) 2026-09-09 — one concern per controller, the shape the
 * other six system controllers already use. Composed by SystemController with the same runtime.
 */
export class SystemScimController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  /**
   * The SCIM base path an IdP is pointed at — the mount point under the versioned API prefix,
   * derived from the same constants the router mounts with (never a hardcoded `/api/v1/...`).
   */
  private get scimBaseUrl(): string {
    return ApiVersionUtils.withVersion(RouteConstants.SEGMENTS.SCIM_BASE);
  }


  /** SCIM provisioning status — whether a bearer token is configured + the SCIM base path. */
  async getScim(_req: Request, res: Response) {
    try {
      const configured = await new ScimTokenService(this.runtime.db).isConfigured();
      res.json({ configured, baseUrl: this.scimBaseUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  /** Rotate (or first-create) the SCIM bearer token — returned ONCE for the admin to paste into the IdP. */
  async rotateScimToken(_req: Request, res: Response) {
    try {
      const token = await new ScimTokenService(this.runtime.db).rotate();
      res.json({ token, baseUrl: this.scimBaseUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
