import express from 'express';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager, ThemeManager } from '@fromcode119/core';
import { AssistantController } from './controller';
import { AssistantRouteConstants } from './assistant-route-constants';
import type { AssistantRoutesContext } from './routes.interfaces';

const R = AssistantRouteConstants.SEGMENTS;

/**
 * Register Assistant API routes
 * Called by AI extension's onInit() hook
 */
export class AssistantRouter {
  static create(context: AssistantRoutesContext): express.Router {
  const { manager, themeManager, auth, restController } = context;
  const router = express.Router();
  const controller = new AssistantController(manager, themeManager, restController);

  router.post(R.ADMIN_ASSISTANT_CHAT, auth.requirePermission('content:read'), (req, res) => controller.assistantChat(req, res));
  router.get(R.ADMIN_ASSISTANT_SESSIONS, auth.requirePermission('content:read'), (req, res) => controller.assistantSessions(req, res));
  router.get(R.ADMIN_ASSISTANT_SESSIONS_ID, auth.requirePermission('content:read'), (req, res) => controller.assistantSession(req, res));
  router.post(R.ADMIN_ASSISTANT_SESSIONS_ID_FORK, auth.requirePermission('content:read'), (req, res) => controller.forkAssistantSession(req, res));
  router.delete(R.ADMIN_ASSISTANT_SESSIONS_ID, auth.requirePermission('content:write'), (req, res) => controller.deleteAssistantSession(req, res));
  router.get(R.ADMIN_ASSISTANT_SKILLS, auth.requirePermission('content:read'), (req, res) => controller.assistantSkills(req, res));
  router.get(R.ADMIN_ASSISTANT_TOOLS, auth.requirePermission('content:read'), (req, res) => controller.assistantTools(req, res));
  router.post(R.ADMIN_ASSISTANT_MODELS, auth.requirePermission('content:read'), (req, res) => controller.assistantModels(req, res));
  router.post(R.ADMIN_ASSISTANT_ACTIONS_EXECUTE, auth.requirePermission('content:write'), (req, res) => controller.executeAssistantActions(req, res));
  router.post(R.ADMIN_ASSISTANT_SESSIONS_ID_CONTINUE, auth.requirePermission('content:read'), (req, res) => controller.continueAssistantSession(req, res));

  // Legacy compatibility route (kept for one release cycle).
  router.post(R.ADMIN_ASSISTANT_EXECUTE_LEGACY, auth.requirePermission('content:write'), (req, res) => controller.executeAssistantLegacy(req, res));

  return router;
  }
}