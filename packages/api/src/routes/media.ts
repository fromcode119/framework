import express from 'express';
import multer from 'multer';
import { AuthManager } from '@fromcode/auth';
import { PluginManager } from '@fromcode/core';
import { MediaManager } from '@fromcode/media';
import { MediaController } from '../controllers/MediaController';

export function setupMediaRoutes(manager: PluginManager, auth: AuthManager, mediaManager: MediaManager) {
  const router = express.Router();
  const controller = new MediaController(manager, mediaManager);
  const upload = multer({ storage: multer.memoryStorage() });

  router.post('/upload', auth.guard(['admin']), upload.single('file'), (req, res) => controller.upload(req, res));
  router.get('/', auth.guard(['admin', 'user']), (req, res) => controller.listFiles(req, res));
  router.get('/folders', auth.guard(['admin', 'user']), (req, res) => controller.listFolders(req, res));
  router.get('/folders/:id/path', auth.guard(['admin', 'user']), (req, res) => controller.getFolderPath(req, res));
  router.post('/folders', auth.guard(['admin']), (req, res) => controller.createFolder(req, res));
  router.patch('/folders/:id', auth.guard(['admin']), (req, res) => controller.updateFolder(req, res));
  router.delete('/folders/:id', auth.guard(['admin']), (req, res) => controller.deleteFolder(req, res));
  router.patch('/:id', auth.guard(['admin']), (req, res) => controller.updateFile(req, res));
  router.delete('/:id', auth.guard(['admin']), (req, res) => controller.deleteFile(req, res));

  return router;
}

