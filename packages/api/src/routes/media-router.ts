import { BaseRouter } from '../routers/BaseRouter';
import multer from 'multer';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager } from '@fromcode119/core';
import { MediaManager } from '@fromcode119/media';
import { MediaController } from '../controllers/media-controller';

/**
 * Media management router.
 * 
 * Handles all media-related endpoints:
 * - File upload and management
 * - Folder organization
 * - File metadata updates
 * 
 * @example
 * ```typescript
 * const mediaRouter = new MediaRouter(pluginManager, authManager, mediaManager);
 * app.use('/api/v1/media', mediaRouter.router);
 * ```
 */
export class MediaRouter extends BaseRouter {
  private controller: MediaController;
  private upload: multer.Multer;

  constructor(
    private manager: PluginManager,
    private auth: AuthManager,
    private mediaManager: MediaManager
  ) {
    super();
    this.controller = new MediaController(manager, mediaManager);
    this.upload = multer({ storage: multer.memoryStorage() });
  }

  protected registerRoutes(): void {
    // File upload
    this.post('/upload', this.auth.guard(['admin']), this.upload.single('file'), 
      this.bind(this.controller.upload));
    
    // File listing and management
    this.get('/', this.auth.guard(['admin', 'user']), this.bind(this.controller.listFiles));
    this.patch('/:id', this.auth.guard(['admin']), this.bind(this.controller.updateFile));
    this.delete('/:id', this.auth.guard(['admin']), this.bind(this.controller.deleteFile));
    
    // Folder management
    this.get('/folders', this.auth.guard(['admin', 'user']), this.bind(this.controller.listFolders));
    this.get('/folders/:id/path', this.auth.guard(['admin', 'user']), this.bind(this.controller.getFolderPath));
    this.post('/folders', this.auth.guard(['admin']), this.bind(this.controller.createFolder));
    this.patch('/folders/:id', this.auth.guard(['admin']), this.bind(this.controller.updateFolder));
    this.delete('/folders/:id', this.auth.guard(['admin']), this.bind(this.controller.deleteFolder));
  }
}
