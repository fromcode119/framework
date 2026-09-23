import { Request, Response } from 'express';
import { BaseController, PluginManager, ThemeManager } from '@fromcode119/core';

/**
 * The account-facing half of the system controller: roles, permissions, users, ownership, updates,
 * data sources, i18n, and two-factor enrolment.
 *
 * Every method is one line, and that is correct — this is a FACADE. The value is that the router
 * depends on one stable name per route while the behaviour lives in whichever controller owns it.
 *
 * The base of `SystemController`, which keeps notifications, webhooks, settings, integrations and
 * the dashboard reads.
 */
export abstract class SystemAccountRoutes extends BaseController {
  protected declare userController: any;
  protected declare adminController: any;
  protected declare runtimeController: any;
  protected declare metadataController: any;
  protected declare settingsController: any;

  async getRoles(req: Request, res: Response) {
    return this.userController.getRoles(req, res);
  }

  async saveRole(req: Request, res: Response) {
    return this.userController.saveRole(req, res);
  }

  async getRole(req: Request, res: Response) {
    return this.userController.getRole(req, res);
  }

  async deleteRole(req: Request, res: Response) {
    return this.userController.deleteRole(req, res);
  }

  async getPermissions(req: Request, res: Response) {
    return this.userController.getPermissions(req, res);
  }

  async savePermission(req: Request, res: Response) {
    return this.userController.savePermission(req, res);
  }

  async getUsers(req: Request, res: Response) {
    return this.userController.getUsers(req, res);
  }

  async saveUser(req: Request, res: Response) {
    return this.userController.saveUser(req, res);
  }

  async getUser(req: Request, res: Response) {
    return this.userController.getUser(req, res);
  }

  async deleteUser(req: Request, res: Response) {
    return this.userController.deleteUser(req, res);
  }

  async saveUserRoles(req: Request, res: Response) {
    return this.userController.saveUserRoles(req, res);
  }

  async transferOwnership(req: Request, res: Response) {
    return this.userController.transferOwnership(req, res);
  }

  async checkUpdate(req: Request, res: Response) {
    return this.runtimeController.checkUpdate(req, res);
  }

  async applyUpdate(req: Request, res: Response) {
    return this.runtimeController.applyUpdate(req, res);
  }

  async getDataSources(req: Request, res: Response) {
    return this.runtimeController.getDataSources(req, res);
  }

  async queryDataSource(req: Request, res: Response) {
    return this.runtimeController.queryDataSource(req, res);
  }

  async getI18n(req: Request, res: Response) {
    return this.runtimeController.getI18n(req, res);
  }

  async resolveSlug(req: Request, res: Response) {
    return this.runtimeController.resolveSlug(req, res);
  }

  async getPageDesign(req: Request, res: Response) {
    return this.runtimeController.getPageDesign(req, res);
  }

  async getEvents(req: Request, res: Response) {
    return this.runtimeController.getEvents(req, res);
  }

  async sendTestTelemetryEmail(req: Request, res: Response) {
    return this.runtimeController.sendTestTelemetryEmail(req, res);
  }

  async getTwoFactorStatus(req: Request, res: Response) {
    return this.userController.getTwoFactorStatus(req, res);
  }

  async setup2FA(req: Request, res: Response) {
    return this.userController.setup2FA(req, res);
  }

  async verify2FA(req: Request, res: Response) {
    return this.userController.verify2FA(req, res);
  }

  async regenerateRecoveryCodes(req: Request, res: Response) {
    return this.userController.regenerateRecoveryCodes(req, res);
  }

  async disable2FA(req: Request, res: Response) {
    return this.userController.disable2FA(req, res);
  }
}
