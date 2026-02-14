import express from 'express';
import { AuthManager } from '@fromcode/auth';
import { PluginManager } from '@fromcode/core';
import { AuthController } from '../controllers/auth-controller';

export function setupAuthRoutes(manager: PluginManager, auth: AuthManager) {
  const router = express.Router();
  const controller = new AuthController(manager, auth);

  router.get('/status', (req, res) => controller.getStatus(req, res));
  router.post('/setup', (req, res) => controller.setup(req, res));
  router.post('/login', (req, res) => controller.login(req, res));
  router.post('/logout', (req, res) => controller.logout(req, res));
  
  router.get('/sessions', auth.guard(['admin']), (req, res) => controller.getSessions(req, res));
  router.post('/sessions/:id/kill', auth.guard(['admin']), (req, res) => controller.killSession(req, res));

  return router;
}

