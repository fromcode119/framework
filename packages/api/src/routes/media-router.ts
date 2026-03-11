import { BaseRouter } from '../routers/base-router';
import multer from 'multer';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager } from '@fromcode119/core';
import { MediaManager } from '@fromcode119/media';
import { MediaController } from '../controllers/media-controller';
import { RouteConstants } from '@fromcode119/core';

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
    this.post(RouteConstants.SEGMENTS.MEDIA_UPLOAD, this.auth.guard(['admin']), this.upload.single('file'), 
      this.bind(this.controller.upload.bind(this.controller)));
    
    // File listing and management
    this.get('/', this.auth.guard(['admin', 'user']), this.bind(this.controller.listFiles.bind(this.controller)));
    this.patch(RouteConstants.SEGMENTS.MEDIA_ID, this.auth.guard(['admin']), this.bind(this.controller.updateFile.bind(this.controller)));
    this.delete(RouteConstants.SEGMENTS.MEDIA_ID, this.auth.guard(['admin']), this.bind(this.controller.deleteFile.bind(this.controller)));
    
    // Folder management
    this.get(RouteConstants.SEGMENTS.MEDIA_FOLDERS, this.auth.guard(['admin', 'user']), this.bind(this.controller.listFolders.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.MEDIA_FOLDERS_ID_PATH, this.auth.guard(['admin', 'user']), this.bind(this.controller.getFolderPath.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.MEDIA_FOLDERS, this.auth.guard(['admin']), this.bind(this.controller.createFolder.bind(this.controller)));
    this.patch(RouteConstants.SEGMENTS.MEDIA_FOLDERS_ID, this.auth.guard(['admin']), this.bind(this.controller.updateFolder.bind(this.controller)));
    this.delete(RouteConstants.SEGMENTS.MEDIA_FOLDERS_ID, this.auth.guard(['admin']), this.bind(this.controller.deleteFolder.bind(this.controller)));
  }
}