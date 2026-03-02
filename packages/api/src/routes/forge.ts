import express from 'express';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager, ThemeManager } from '@fromcode119/core';
import { RESTController } from '../controllers/rest-controller';
import { ForgeController } from '../controllers/forge-controller';

export function setupForgeRoutes(manager: PluginManager, themeManager: ThemeManager, auth: AuthManager, restController: RESTController) {
  const router = express.Router();
  const controller = new ForgeController(manager, themeManager, restController);

  router.post('/admin/assistant/chat', auth.requirePermission('content:read'), (req, res) => controller.assistantChat(req, res));
  router.get('/admin/assistant/sessions', auth.requirePermission('content:read'), (req, res) => controller.assistantSessions(req, res));
  router.get('/admin/assistant/sessions/:id', auth.requirePermission('content:read'), (req, res) => controller.assistantSession(req, res));
  router.post('/admin/assistant/sessions/:id/fork', auth.requirePermission('content:read'), (req, res) => controller.forkAssistantSession(req, res));
  router.delete('/admin/assistant/sessions/:id', auth.requirePermission('content:write'), (req, res) => controller.deleteAssistantSession(req, res));
  router.get('/admin/assistant/skills', auth.requirePermission('content:read'), (req, res) => controller.assistantSkills(req, res));
  router.get('/admin/assistant/tools', auth.requirePermission('content:read'), (req, res) => controller.assistantTools(req, res));
  router.post('/admin/assistant/models', auth.requirePermission('content:read'), (req, res) => controller.assistantModels(req, res));
  router.post('/admin/assistant/actions/execute', auth.requirePermission('content:write'), (req, res) => controller.executeAssistantActions(req, res));
  router.post('/admin/assistant/sessions/:id/continue', auth.requirePermission('content:read'), (req, res) => controller.continueAssistantSession(req, res));

  // Legacy compatibility routes (kept for one release cycle).
  router.get('/admin/assistant/personas', auth.requirePermission('content:read'), (req, res) => controller.assistantPersonasLegacy(req, res));
  router.post('/admin/assistant/execute', auth.requirePermission('content:write'), (req, res) => controller.executeAssistantLegacy(req, res));

  return router;
}
