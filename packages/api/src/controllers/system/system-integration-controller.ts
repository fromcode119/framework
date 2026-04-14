import { Request, Response } from 'express';
import { CoercionUtils } from '@fromcode119/core';
import { SystemControllerRuntime } from './system-controller-runtime';

export class SystemIntegrationController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  async getIntegrations(req: Request, res: Response) {
    try {
      const data = await this.runtime.manager.integrations.listConfigs();
      res.json({ docs: data, totalDocs: data.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getIntegration(req: Request, res: Response) {
    try {
      const integration = await this.runtime.manager.integrations.getConfig(req.params.type);
      if (!integration) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(integration);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateIntegration(req: Request, res: Response) {
    try {
      const updated = await (this.runtime.manager.integrations as any).updateConfig(
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
      );
      res.json({ success: !!updated, integration: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async setIntegrationProviderEnabled(req: Request, res: Response) {
    try {
      const updated = await (this.runtime.manager.integrations as any).setProviderEnabled(
        req.params.type,
        req.params.providerId,
        CoercionUtils.toBoolean(req.body?.enabled)
      );
      res.json({ success: !!updated, integration: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async removeIntegrationProvider(req: Request, res: Response) {
    try {
      const updated = await (this.runtime.manager.integrations as any).removeProvider(req.params.type, req.params.providerId);
      res.json({ success: !!updated, integration: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async activateIntegrationProfile(req: Request, res: Response) {
    try {
      const updated = await (this.runtime.manager.integrations as any).activateProfile(req.params.type, req.params.profileId);
      res.json({ success: !!updated, integration: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async renameIntegrationProfile(req: Request, res: Response) {
    try {
      const profileName = String(req.body?.profileName || req.body?.name || '').trim();
      if (!profileName) {
        return res.status(400).json({ error: 'profileName is required' });
      }
      const updated = await (this.runtime.manager.integrations as any).renameProfile(
        req.params.type,
        req.params.profileId,
        profileName
      );
      res.json({ success: !!updated, integration: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteIntegrationProfile(req: Request, res: Response) {
    try {
      const updated = await (this.runtime.manager.integrations as any).deleteProfile(req.params.type, req.params.profileId);
      res.json({ success: !!updated, integration: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}