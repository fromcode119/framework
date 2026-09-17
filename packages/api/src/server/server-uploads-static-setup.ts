import express from 'express';
import { MediaManager } from '@fromcode119/media';
import { ApiConfig } from '@api/config/api-config';
import { ServerUploadsConfigService } from '@api/server/server-uploads-config-service';
import { TenantUploadsStatic } from '@api/server/tenant-uploads-static';

/** Serving the uploads directory: per-SITE, with the shared parent behind it. */
export class ServerUploadsStaticSetup {
  /**
   * SVG is an active document format: it is served with an explicit type and a CSP that blocks
   * script/object/frame execution — defence in depth on top of the upload-time `MediaSvgSanitizer`.
   */
  private static readonly OPTIONS = {
    maxAge: '30d',
    setHeaders: (res: express.Response, filePath: string) => {
      if (filePath.toLowerCase().endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      }
    },
  };

  /**
   * Mount the static handler and answer where it was mounted, for the boot log.
   *
   * The legacy default path is mounted too, for files written before the operator moved the
   * directory. See `TenantUploadsStatic` for why the tenant is resolved from the HOST here rather
   * than read from the request context.
   */
  static mount(
    app: express.Application,
    db: unknown,
    projectRoot: string,
    mediaManager: MediaManager | undefined,
  ): { uploadDir: string; publicPath: string } {
    const config = ServerUploadsConfigService.resolve(projectRoot, mediaManager);
    const uploadsStatic = new TenantUploadsStatic(db as never, ServerUploadsStaticSetup.OPTIONS).middleware();
    app.use(config.publicPath, uploadsStatic);
    if (config.publicPath !== ApiConfig.getInstance().storage.DEFAULT_PUBLIC_URL) {
      app.use(ApiConfig.getInstance().storage.DEFAULT_PUBLIC_URL, uploadsStatic);
    }
    return config;
  }
}
