import express from 'express';
import { AuthManager } from '@fromcode/auth';
import { PluginManager } from '@fromcode/core';
import { AuthController } from '../controllers/auth-controller';

export function setupAuthRoutes(manager: PluginManager, auth: AuthManager) {
  const router = express.Router();
  const controller = new AuthController(manager, auth);

  router.get('/status', (req, res) => controller.getStatus(req, res));
  router.post('/setup', (req, res) => controller.setup(req, res));
  router.post('/register', (req, res) => controller.register(req, res));
  router.post('/verify-email', (req, res) => controller.verifyEmail(req, res));
  router.post('/resend-verification', (req, res) => controller.resendVerification(req, res));
  router.post('/forgot-password', (req, res) => controller.forgotPassword(req, res));
  router.post('/reset-password', (req, res) => controller.resetPassword(req, res));
  router.get('/sso/providers', (req, res) => controller.getSsoProviders(req, res));
  router.post('/sso/login', (req, res) => controller.ssoLogin(req, res));
  router.post('/login', (req, res) => controller.login(req, res));
  router.post('/logout', (req, res) => controller.logout(req, res));

  router.get('/security', auth.guard(), (req, res) => controller.getMySecurityState(req, res));
  router.post('/change-password', auth.guard(), (req, res) => controller.changePassword(req, res));
  router.post('/email-change/request', auth.guard(), (req, res) => controller.requestEmailChange(req, res));
  router.post('/email-change/confirm', (req, res) => controller.confirmEmailChange(req, res));

  router.get('/sessions/me', auth.guard(), (req, res) => controller.getMySessions(req, res));
  router.post('/sessions/:id/revoke', auth.guard(), (req, res) => controller.revokeMySession(req, res));
  router.post('/sessions/revoke-others', auth.guard(), (req, res) => controller.revokeOtherSessions(req, res));

  router.get('/api-tokens', auth.guard(), (req, res) => controller.listMyApiTokens(req, res));
  router.post('/api-tokens', auth.guard(), (req, res) => controller.createMyApiToken(req, res));
  router.delete('/api-tokens/:id', auth.guard(), (req, res) => controller.revokeMyApiToken(req, res));

  router.get('/sessions', auth.guard(['admin']), (req, res) => controller.getSessions(req, res));
  router.post('/sessions/:id/kill', auth.guard(['admin']), (req, res) => controller.killSession(req, res));

  return router;
}
