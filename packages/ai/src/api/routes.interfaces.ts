import type { PluginManager, ThemeManager } from '@fromcode119/core';
import type { AuthManager } from '@fromcode119/auth';
import type { RESTController } from './controller.types';

export interface AssistantRoutesContext {
  manager: PluginManager;
  themeManager: ThemeManager;
  auth: AuthManager;
  restController: RESTController;
}
