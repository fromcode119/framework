import { Request, Response } from 'express';
import { AuthManager } from '@fromcode119/auth';
import { BaseController, PluginManager, ThemeManager } from '@fromcode119/core';
import { RESTController } from '@api/controllers/rest/rest-controller';
import { SystemAdminController } from '@api/controllers/system/system-admin-controller';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';
import { SystemDeployController } from '@api/controllers/system/system-deploy-controller';
import { SystemIntegrationController } from '@api/controllers/system/system-integration-controller';
import { SystemRuntimeController } from '@api/controllers/system/system-runtime-controller';
import { SystemUserController } from '@api/controllers/system/system-user-controller';
import { SystemPeopleController } from '@api/controllers/system/system-people-controller';
import { SystemRecordLinksController } from '@api/controllers/system/system-record-links-controller';
import { SystemSettingsController } from '@api/controllers/system/system-settings-controller';
import { SystemMetadataController } from '@api/controllers/system/system-metadata-controller';
import { SystemScimController } from '@api/controllers/system/system-scim-controller';
import { SystemWebhooksController } from '@api/controllers/system/system-webhooks-controller';
import { SystemNotificationsController } from '@api/controllers/system/system-notifications-controller';
import { SystemAccountRoutes } from '@api/controllers/system/system-account-routes';

export class SystemController extends SystemAccountRoutes {
  protected readonly adminController: SystemAdminController;
  private readonly integrationController: SystemIntegrationController;
  protected readonly runtimeController: SystemRuntimeController;
  protected readonly userController: SystemUserController;
  private readonly peopleController: SystemPeopleController;
  private readonly recordLinksController: SystemRecordLinksController;
  private readonly deployController: SystemDeployController;
  protected readonly settingsController: SystemSettingsController;
  protected readonly metadataController: SystemMetadataController;
  private readonly scimController: SystemScimController;
  private readonly webhooksController: SystemWebhooksController;
  private readonly notificationsController: SystemNotificationsController;

  constructor(
    manager: PluginManager,
    themeManager: ThemeManager,
    restController: RESTController,
    auth: AuthManager
  ) {
    super();
    const runtime = new SystemControllerRuntime(manager, themeManager, restController, auth);
    this.adminController = new SystemAdminController(runtime);
    this.integrationController = new SystemIntegrationController(runtime);
    this.runtimeController = new SystemRuntimeController(runtime);
    this.userController = new SystemUserController(runtime);
    this.peopleController = new SystemPeopleController(runtime);
    this.recordLinksController = new SystemRecordLinksController();
    this.deployController = new SystemDeployController(runtime);
    this.settingsController = new SystemSettingsController(runtime);
    this.metadataController = new SystemMetadataController(runtime);
    this.scimController = new SystemScimController(runtime);
    this.webhooksController = new SystemWebhooksController(runtime);
    this.notificationsController = new SystemNotificationsController(runtime);
  }

  /** Recipient suggestions for the share composer — the people directory, projected for a picker. */
  async suggestRecipients(req: Request, res: Response) {
    return this.peopleController.suggestRecipients(req, res);
  }

  async getPeople(req: Request, res: Response) {
    return this.peopleController.getPeople(req, res);
  }

  async getPerson(req: Request, res: Response) {
    return this.peopleController.getPerson(req, res);
  }

  async getPersonRecords(req: Request, res: Response) {
    return this.peopleController.getPersonRecords(req, res);
  }

  async getRecordsByRef(req: Request, res: Response) {
    return this.peopleController.getRecordsByRef(req, res);
  }

  async getRecordLinks(req: Request, res: Response) {
    return this.recordLinksController.getRecordLinks(req, res);
  }

  async savePerson(req: Request, res: Response) {
    return this.peopleController.savePerson(req, res);
  }

  async createUserFromPerson(req: Request, res: Response) {
    return this.peopleController.createUserFromPerson(req, res);
  }

  async deletePerson(req: Request, res: Response) {
    return this.peopleController.deletePerson(req, res);
  }

  async linkUser(req: Request, res: Response) {
    return this.peopleController.linkUser(req, res);
  }

  async getAdminMetadata(req: Request, res: Response) {
    return this.metadataController.getAdminMetadata(req, res);
  }

  async search(req: Request, res: Response) {
    return this.adminController.search(req, res);
  }

  async getNotifications(req: Request, res: Response) {
    return this.notificationsController.getNotifications(req, res);
  }

  async getWebhooks(req: Request, res: Response) {
    return this.webhooksController.getWebhooks(req, res);
  }

  async testWebhook(req: Request, res: Response) {
    return this.webhooksController.testWebhook(req, res);
  }

  async resendWebhookDelivery(req: Request, res: Response) {
    return this.webhooksController.resendWebhookDelivery(req, res);
  }

  async getScim(req: Request, res: Response) {
    return this.scimController.getScim(req, res);
  }

  async rotateScimToken(req: Request, res: Response) {
    return this.scimController.rotateScimToken(req, res);
  }

  async getPreference(req: Request, res: Response) {
    return this.notificationsController.getPreference(req, res);
  }

  async setPreference(req: Request, res: Response) {
    return this.notificationsController.setPreference(req, res);
  }

  async markNotificationRead(req: Request, res: Response) {
    return this.notificationsController.markNotificationRead(req, res);
  }

  async markAllNotificationsRead(req: Request, res: Response) {
    return this.notificationsController.markAllNotificationsRead(req, res);
  }

  async getSettings(req: Request, res: Response) {
    return this.settingsController.getSettings(req, res);
  }

  async getPersonalDataPolicy(req: Request, res: Response) {
    return this.settingsController.getPersonalDataPolicy(req, res);
  }

  async platformSettingKeys(req: Request, res: Response) {
    return this.settingsController.platformSettingKeys(req, res);
  }

  async updateSettings(req: Request, res: Response) {
    return this.settingsController.updateSettings(req, res);
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
    return this.metadataController.getFrontendMetadata(req, res);
  }

  async listDeployApps(req: Request, res: Response) {
    return this.deployController.listApps(req, res);
  }

  async restartApp(req: Request, res: Response) {
    return this.deployController.restart(req, res);
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

  async getHostStats(req: Request, res: Response) {
    return this.adminController.getHostStats(req, res);
  }

  async getScheduleOutlook(req: Request, res: Response) {
    return this.adminController.getScheduleOutlook(req, res);
  }

  async getAttention(req: Request, res: Response) {
    return this.adminController.getAttention(req, res);
  }

  async getSiteStats(req: Request, res: Response) {
    return this.adminController.getSiteStats(req, res);
  }

  async getRecentEdits(req: Request, res: Response) {
    return this.adminController.getRecentEdits(req, res);
  }

  async getInstallation(req: Request, res: Response) {
    return this.adminController.getInstallation(req, res);
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

}