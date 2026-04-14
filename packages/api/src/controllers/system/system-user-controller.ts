import { Request, Response } from 'express';
import { SystemControllerRuntime } from './system-controller-runtime';

export class SystemUserController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  async getRoles(req: Request, res: Response) {
    try {
      res.json(await this.runtime.users.getRoles());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async saveRole(req: Request, res: Response) {
    try {
      await this.runtime.users.saveRole(req.params.slug || req.body.slug, req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getRole(req: Request, res: Response) {
    try {
      const role = await this.runtime.users.getRole(req.params.slug);
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }
      res.json(role);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteRole(req: Request, res: Response) {
    try {
      await this.runtime.users.deleteRole(req.params.slug);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getPermissions(req: Request, res: Response) {
    try {
      res.json(await this.runtime.users.getPermissions());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async savePermission(req: Request, res: Response) {
    try {
      await this.runtime.users.savePermission(req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getUsers(req: Request, res: Response) {
    try {
      res.json({ docs: await this.runtime.users.getUsers() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async saveUser(req: Request, res: Response) {
    try {
      const id = await this.runtime.users.saveUser(req.params.id ? parseInt(req.params.id, 10) : null, req.body);
      res.json({ success: true, id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      const user = await this.runtime.users.getUser(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      await this.runtime.users.deleteUser(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async saveUserRoles(req: Request, res: Response) {
    try {
      const userId = parseInt(String(req.body?.userId || req.params?.id || ''), 10);
      if (Number.isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      const roles = Array.isArray(req.body?.roles) ? req.body.roles : [];
      await this.runtime.users.saveUserRoles(userId, roles);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getTwoFactorStatus(req: Request, res: Response) {
    return this.runtime.twoFactor.getTwoFactorStatus(req, res);
  }

  async setup2FA(req: Request, res: Response) {
    return this.runtime.twoFactor.setup2FA(req, res);
  }

  async verify2FA(req: Request, res: Response) {
    return this.runtime.twoFactor.verify2FA(req, res);
  }

  async regenerateRecoveryCodes(req: Request, res: Response) {
    return this.runtime.twoFactor.regenerateRecoveryCodes(req, res);
  }

  async disable2FA(req: Request, res: Response) {
    return this.runtime.twoFactor.disable2FA(req, res);
  }
}