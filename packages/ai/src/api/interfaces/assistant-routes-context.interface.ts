import type { PluginManager, ThemeManager } from '@fromcode119/core';
import type { AuthManager } from '@fromcode119/auth';
import type { IRestController } from '@ai/api/interfaces/rest-controller.interface';

export interface IAssistantRoutesContext {
  manager: PluginManager;
  themeManager: ThemeManager;
  auth: AuthManager;
  restController: IRestController;
}
