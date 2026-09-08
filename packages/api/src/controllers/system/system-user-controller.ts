import { Request, Response } from 'express';
import { RequestParamUtils } from '@api/utils/request-param-utils';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';
import { CoercionUtils, PlatformOwnershipService } from '@fromcode119/core';
import { TenantUserScope } from '@api/services/request/tenant-user-scope';

export class SystemUserController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  /** The accounts this request may see and act on — its site's members. See {@link TenantUserScope}. */
  private scope(req: Request): Promise<TenantUserScope> {
    return TenantUserScope.of(req, this.runtime.db);
  }

  /**
   * Refuses an account outside the caller's site — as NOT FOUND, not as forbidden: "you may not touch
   * user 41" still confirms that user 41 exists, which is the fact being protected.
   */
  private async denyOutsideScope(req: Request, res: Response, userId: number): Promise<boolean> {
    if ((await this.scope(req)).allows(userId)) return false;
    res.status(404).json({ error: 'User not found' });
    return true;
  }

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
      const role = await this.runtime.users.getRole(CoercionUtils.toString(req.params.slug));
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
      await this.runtime.users.deleteRole(CoercionUtils.toString(req.params.slug));
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
      res.json({ docs: await this.runtime.users.getUsers((await this.scope(req)).ids) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async saveUser(req: Request, res: Response) {
    try {
      const id = req.params.id ? CoercionUtils.toRelationId(req.params?.id) : null;
      // Creating is unrestricted (a new account belongs to no site yet); EDITING an existing one is not.
      if (id !== null && await this.denyOutsideScope(req, res, id)) return;
      const saved = await this.runtime.users.saveUser(id, req.body);
      res.json({ success: true, id: saved });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getUser(req: Request, res: Response) {
    try {
      const id = RequestParamUtils.relationId(req, res, 'user');
      if (id === null) return;
      if (await this.denyOutsideScope(req, res, id)) return;
      const user = await this.runtime.users.getUser(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Hands the platform owner seat to another account. The caller must BE the current owner — the
   * service re-checks that inside the transaction, so a stale session cannot transfer a seat it no
   * longer holds — and the previous owner stays on as an ordinary admin.
   */
  async transferOwnership(req: Request, res: Response) {
    try {
      const id = RequestParamUtils.relationId(req, res, 'user');
      if (id === null) return;

      const callerId = CoercionUtils.toRelationId((req as any).user?.id);
      if (callerId === null) {
        return res.status(401).json({ error: 'Authentication is required to transfer ownership' });
      }

      await new PlatformOwnershipService(this.runtime.db).transfer(callerId, id);
      res.json({ success: true, ownerId: id });
    } catch (error: any) {
      // Every refusal the service raises names its own status; anything without one is a genuine fault.
      res.status(CoercionUtils.toNumber(error?.statusCode) || 500).json({ error: error.message });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const id = RequestParamUtils.relationId(req, res, 'user');
      if (id === null) return;
      if (await this.denyOutsideScope(req, res, id)) return;
      await this.runtime.users.deleteUser(id);
      res.json({ success: true });
    } catch (error: any) {
      // A refusal names its own status (the owner seat cannot be deleted); anything else is a fault.
      res.status(CoercionUtils.toNumber(error?.statusCode) || 500).json({ error: error.message });
    }
  }

  async saveUserRoles(req: Request, res: Response) {
    try {
      const userId = CoercionUtils.toRelationId(req.body?.userId) ?? CoercionUtils.toRelationId(req.params?.id);
      if (userId === null) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      if (await this.denyOutsideScope(req, res, userId)) return;
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
