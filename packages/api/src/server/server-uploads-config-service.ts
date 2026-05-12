import * as path from 'path';
import { MediaManager } from '@fromcode119/media';
import { ApiConfig } from '../config/api-config';
import { ApiUrlUtils } from '../utils/url';

export class ServerUploadsConfigService {
  static resolve(
    projectRoot: string,
    mediaManager?: MediaManager,
  ): { uploadDir: string; publicUrlBase: string; publicPath: string } {
    let uploadDir = process.env[ApiConfig.getInstance().storage.UPLOAD_DIR_ENV]
      || path.resolve(projectRoot, ApiConfig.getInstance().storage.DEFAULT_UPLOADS_SUBDIR);
    let publicUrlBase = ApiUrlUtils.resolveStoragePublicUrlBase(
      process.env[ApiConfig.getInstance().storage.PUBLIC_URL_ENV],
    );

    const driver: any = mediaManager?.driver;
    if (driver && String(driver.provider || '').trim().toLowerCase() === 'local') {
      const driverUploadDir = String(driver.uploadDir || '').trim();
      const driverPublicUrlBase = String(driver.publicUrlBase || '').trim();

      if (driverUploadDir) {
        uploadDir = path.isAbsolute(driverUploadDir)
          ? path.normalize(driverUploadDir)
          : path.resolve(projectRoot, driverUploadDir);
      }

      if (driverPublicUrlBase) {
        publicUrlBase = ApiUrlUtils.resolveStoragePublicUrlBase(driverPublicUrlBase);
      }
    }

    return {
      uploadDir,
      publicUrlBase,
      publicPath: ApiUrlUtils.resolveStoragePublicPath(publicUrlBase),
    };
  }
}
