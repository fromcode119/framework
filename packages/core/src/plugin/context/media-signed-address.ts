import { SystemApiPaths } from '@core/constants/system-api-paths.constants';
import { ApiPathUtils } from '@core/api/api-path-utils';
import { MediaSignedTokens } from '@core/media/media-signed-tokens';
import { SiteBaseUrl } from '@core/tenant/site-base-url';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

/**
 * The address `context.media.signedUrl` hands out: the API's signed route for one file, on this site's API
 * host, ending in `file.<type>` from the file's own name. A player that keeps what it plays (a phone app)
 * decides by that ending whether the file can be kept, and the stored name is never shown.
 *
 * The path names the file (`/signed/<id>/file.<type>`) and the token rides in the query (`?t=`): a token
 * lasts at most a day, and a client that keeps files under their path keeps one copy per file instead of
 * fetching it again whenever a new token is handed out. The id opens nothing by itself.
 */
export class MediaSignedAddress {
  private static readonly TYPE = /\.([a-z0-9]{1,8})$/i;
  /** The query parameter carrying the token when the path names the file. */
  static readonly QUERY = 't';

  constructor(private readonly manager: IPluginManagerInterface) {}

  async of(row: Record<string, any>, ttlSeconds?: number): Promise<string> {
    const token = await new MediaSignedTokens(this.manager).mint(String(row.id), MediaSignedTokens.ttl(ttlSeconds));
    const path = ApiPathUtils.versioned(ApiPathUtils.fillPath(SystemApiPaths.ALL.MEDIA.SIGNED, { token: String(row.id), file: MediaSignedAddress.fileName(row) }));
    return `${await SiteBaseUrl.apiUrlForCurrentSite(path)}?${MediaSignedAddress.QUERY}=${encodeURIComponent(token)}`;
  }

  /** `file.<type>` from the stored or original name; plain `file` when neither names a type. */
  static fileName(row: Record<string, any>): string {
    const type = [row.filename, row.originalName, row.path].map((name) => MediaSignedAddress.TYPE.exec(String(name ?? ''))?.[1]).find(Boolean);
    return type ? `file.${type.toLowerCase()}` : 'file';
  }
}
