import { Request, Response } from 'express';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager, ThemeManager } from '@fromcode119/core';
import { RESTController } from '../rest/rest-controller';
import { SystemAdminController } from './system-admin-controller';
import { SystemControllerRuntime } from './system-controller-runtime';
import { SystemIntegrationController } from './system-integration-controller';
import { SystemRuntimeController } from './system-runtime-controller';
import { SystemUserController } from './system-user-controller';

export class SystemController {
  private readonly adminController: SystemAdminController;
  private readonly integrationController: SystemIntegrationController;
  private readonly runtimeController: SystemRuntimeController;
  private readonly userController: SystemUserController;

  constructor(
    manager: PluginManager,
    themeManager: ThemeManager,
    restController: RESTController,
    auth: AuthManager
  ) {
    const runtime = new SystemControllerRuntime(manager, themeManager, restController, auth);
    this.adminController = new SystemAdminController(runtime);
    this.integrationController = new SystemIntegrationController(runtime);
    this.runtimeController = new SystemRuntimeController(runtime);
    this.userController = new SystemUserController(runtime);
  }

  async getAdminMetadata(req: Request, res: Response) {
    return this.adminController.getAdminMetadata(req, res);
  }

  async getSettings(req: Request, res: Response) {
    return this.adminController.getSettings(req, res);
  }

  async updateSettings(req: Request, res: Response) {
    return this.adminController.updateSettings(req, res);
  }

  async getIntegrations(req: Request, res: Response) {
    return this.integrationController.getIntegrations(req, res);
  }

  async getIntegration(req: Request, res: Response) {
    return this.integrationController.getIntegration(req, res);
  }

  async updateIntegration(req: Request, res: Response) {
    return this.integrationController.updateIntegration(req, res);
  }

  async setIntegrationProviderEnabled(req: Request, res: Response) {
    return this.integrationController.setIntegrationProviderEnabled(req, res);
  }

  async removeIntegrationProvider(req: Request, res: Response) {
    return this.integrationController.removeIntegrationProvider(req, res);
  }

  async activateIntegrationProfile(req: Request, res: Response) {
    return this.integrationController.activateIntegrationProfile(req, res);
  }

  async renameIntegrationProfile(req: Request, res: Response) {
    return this.integrationController.renameIntegrationProfile(req, res);
  }

  async deleteIntegrationProfile(req: Request, res: Response) {
    return this.integrationController.deleteIntegrationProfile(req, res);
  }

  async getFrontendMetadata(req: Request, res: Response) {
    return this.adminController.getFrontendMetadata(req, res);
  }

  async getThemes(req: Request, res: Response) {
    return this.adminController.getThemes(req, res);
  }

  async activateTheme(req: Request, res: Response) {
    return this.adminController.activateTheme(req, res);
  }

  async getStats(req: Request, res: Response) {
    return this.adminController.getStats(req, res);
  }

  async getSecurityStats(req: Request, res: Response) {
    return this.adminController.getSecurityStats(req, res);
  }

  async getActivity(req: Request, res: Response) {
    return this.runtimeController.getActivity(req, res);
  }

  async getShortcodes(req: Request, res: Response) {
    return this.runtimeController.getShortcodes(req, res);
  }

  async renderShortcodes(req: Request, res: Response) {
    return this.runtimeController.renderShortcodes(req, res);
  }

  async getLogs(req: Request, res: Response) {
    return this.runtimeController.getLogs(req, res);
  }

  async getAuditLogs(req: Request, res: Response) {
    return this.runtimeController.getAuditLogs(req, res);
  }

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