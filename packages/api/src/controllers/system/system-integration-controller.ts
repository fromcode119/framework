import { Request, Response } from 'express';
import { CoercionUtils, RequestContextUtils } from '@fromcode119/core';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';

export class SystemIntegrationController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  async getIntegrations(req: Request, res: Response) {
    try {
      // A platform-only type (monitoring) is the platform admin's: a site never lists it.
      const all = await this.runtime.manager.integrations.listConfigs();
      const data = RequestContextUtils.getTenantId() ? all.filter((entry: { platformOnly?: boolean }) => !entry.platformOnly) : all;
      res.json({ docs: data, totalDocs: data.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getIntegration(req: Request, res: Response) {
    if (await this.refusedForSite(req, res)) return;
    try {
      const integration = await this.runtime.manager.integrations.getConfig(CoercionUtils.toString(req.params.type));
      if (!integration) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(integration);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateIntegration(req: Request, res: Response) {
    if (await this.refusedForSite(req, res) || await this.refusedForPlatform(req, res)) return;
    try {
      const updated = await this.asScope(() => (this.runtime.manager.integrations as any).updateConfig(
        req.params.type,
        req.body.provider,
        req.body.config || {},
        {
          profileId: req.body.profileId,
          profileName: req.body.profileName,
          providerId: req.body.providerId,
          providerName: req.body.providerName,
          makeActive: req.body.makeActive === undefined ? true : CoercionUtils.toBoolean(req.body.makeActive),
          enabled: req.body.enabled === undefined ? undefined : CoercionUtils.toBoolean(req.body.enabled),
        }
      ));
      res.json({ success: !!updated, integration: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async setIntegrationProviderEnabled(req: Request, res: Response) {
    if (await this.refusedForSite(req, res) || await this.refusedForPlatform(req, res)) return;
    try {
      const updated = await this.asScope(() => (this.runtime.manager.integrations as any).setProviderEnabled(
        req.params.type,
        req.params.providerId,
        CoercionUtils.toBoolean(req.body?.enabled)
      ));
      res.json({ success: !!updated, integration: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async removeIntegrationProvider(req: Request, res: Response) {
    if (await this.refusedForSite(req, res) || await this.refusedForPlatform(req, res)) return;
    try {
      const updated = await this.asScope(() => (this.runtime.manager.integrations as any).removeProvider(req.params.type, req.params.providerId));
      res.json({ success: !!updated, integration: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async activateIntegrationProfile(req: Request, res: Response) {
    if (await this.refusedForSite(req, res) || await this.refusedForPlatform(req, res)) return;
    try {
      const updated = await this.asScope(() => (this.runtime.manager.integrations as any).activateProfile(req.params.type, req.params.profileId));
      res.json({ success: !!updated, integration: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async renameIntegrationProfile(req: Request, res: Response) {
    if (await this.refusedForSite(req, res) || await this.refusedForPlatform(req, res)) return;
    try {
      const profileName = CoercionUtils.toString(req.body?.profileName) || CoercionUtils.toString(req.body?.name);
      if (!profileName) {
        return res.status(400).json({ error: 'profileName is required' });
      }
      const updated = await this.asScope(() => (this.runtime.manager.integrations as any).renameProfile(
        req.params.type,
        req.params.profileId,
        profileName
      ));
      res.json({ success: !!updated, integration: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteIntegrationProfile(req: Request, res: Response) {
    if (await this.refusedForSite(req, res) || await this.refusedForPlatform(req, res)) return;
    try {
      const updated = await this.asScope(() => (this.runtime.manager.integrations as any).deleteProfile(req.params.type, req.params.profileId));
      res.json({ success: !!updated, integration: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Platform scope (no site bound) writes the platform's own rows (`tenant_id IS NULL`), which the database
   * accepts only under the platform-admin marker — so only a platform admin may, and the write runs under
   * it. Without it every save in platform scope failed with "new row violates row-level security policy".
   * Inside a site the write stays the site's, on the site's own connection.
   */
  private async refusedForPlatform(req: Request, res: Response): Promise<boolean> {
    if (RequestContextUtils.getTenantId() || await this.runtime.isPlatformAdmin(req)) return false;
    res.status(403).json({ error: 'platform_admin_required', message: 'Only a platform admin can change the platform\'s integrations.' });
    return true;
  }

  private asScope<T>(write: () => Promise<T>): Promise<T> {
    return RequestContextUtils.getTenantId() ? write() : this.runtime.db.withPlatformAdmin(write);
  }

  /**
   * A platform-only type changed from inside a site would write an entry nothing reads, so it is refused
   * with the reason rather than saved and ignored.
   */
  private async refusedForSite(req: Request, res: Response): Promise<boolean> {
    if (!RequestContextUtils.getTenantId()) return false;
    const summary = await this.runtime.manager.integrations.getConfig(CoercionUtils.toString(req.params.type));
    if (!summary?.platformOnly) return false;
    // The label lets a bookmarked link opened inside a site say WHICH screen lives on the platform.
    res.status(403).json({ error: 'platform_only_integration', label: summary.label });
    return true;
  }
}
