import { ClientRuntimeConstants } from '@core/constants/client-runtime.constants';
import { ConsoleAssetConstants } from '@core/constants/console-asset.constants';

/**
 * A console mounted on a PATH of a site's own host (`shop.example.com/backend`), the site form's
 * "Console path".
 *
 * The gateway strips that path before the request reaches the admin, so the admin's routes stay
 * exactly what they are on a console host, and tells it where it is mounted in `HEADER`. Every place
 * the admin writes an address — links, router pushes, full-page moves, its own assets — puts the
 * mount back in front. The gateway deletes any copy of the header a client sends, so only the gateway
 * can claim a mount.
 */
export class ConsoleMountConstants {
  /** Request header the gateway sets to the mount path (`/backend`) on a mounted request; absent otherwise. */
  static readonly HEADER = 'x-fc-console-mount' as const;

  /** Where the admin's built assets are served on a mounted console — see `ConsoleAssetConstants`. */
  static readonly ASSET_PREFIX = ConsoleAssetConstants.PREFIX;

  /** `<html>` attribute carrying the mount to browser code that runs outside React. */
  static readonly ATTRIBUTE = `${ClientRuntimeConstants.ATTRIBUTE_PREFIX}console-mount` as const;
}
