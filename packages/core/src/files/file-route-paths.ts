import { RouteConstants } from '@core/constants/route.constants';

/**
 * Concrete file-delivery URLs, built from the SAME segment templates the router registers.
 *
 * Without this a client hand-writes `/my/shares/${id}/download/${mediaId}` and the two drift the first
 * time a segment is renamed — the router keeps working, the link 404s, and nothing fails at build time
 * because both halves are just strings. Substituting into the template makes the constant the single
 * authority for both sides.
 */
export class FileRoutePaths {
  /** `/files` — the router's mount point under the versioned API prefix. */
  static get base(): string {
    return RouteConstants.SEGMENTS.FILES;
  }

  private static fill(template: string, values: Record<string, string | number>): string {
    return Object.entries(values).reduce(
      (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(String(value))),
      template,
    );
  }

  /** What a recipient opens: the share behind a token. */
  static token(rawToken: string): string {
    return `${FileRoutePaths.base}${FileRoutePaths.fill(RouteConstants.SEGMENTS.FILES_TOKEN, { token: rawToken })}`;
  }

  static tokenDownload(rawToken: string, mediaId: number): string {
    return `${FileRoutePaths.base}${FileRoutePaths.fill(RouteConstants.SEGMENTS.FILES_TOKEN_DOWNLOAD, { token: rawToken, mediaId })}`;
  }

  /** The signed-in recipient's own files — no token involved, the session is the credential. */
  static myShares(): string {
    return `${FileRoutePaths.base}${RouteConstants.SEGMENTS.FILES_MY_SHARES}`;
  }

  /**
   * The same path WITHOUT the `/files` prefix, for a caller already scoped to it (`SdkClient.getFiles`).
   *
   * Kept beside the absolute form on purpose: a client that prefixes the scope and a path that also
   * carries it produce `/files/files/...`, and one that assumes the opposite produces
   * `/v1/auth/files/...`. Both are silent 404s, so the two shapes are named rather than guessed at.
   */
  static mySharesScoped(): string {
    return RouteConstants.SEGMENTS.FILES_MY_SHARES;
  }

  static myDownload(shareId: number, mediaId: number): string {
    return `${FileRoutePaths.base}${FileRoutePaths.fill(RouteConstants.SEGMENTS.FILES_MY_DOWNLOAD, { shareId, mediaId })}`;
  }

  /** Operator-side. */
  static shares(): string {
    return `${FileRoutePaths.base}${RouteConstants.SEGMENTS.FILES_SHARES}`;
  }

  static shareGrants(shareId: number): string {
    return `${FileRoutePaths.base}${FileRoutePaths.fill(RouteConstants.SEGMENTS.FILES_SHARE_GRANTS, { shareId })}`;
  }

  static share(shareId: number): string {
    return `${FileRoutePaths.base}${FileRoutePaths.fill(RouteConstants.SEGMENTS.FILES_SHARE_ID, { shareId })}`;
  }

  static grant(grantId: number): string {
    return `${FileRoutePaths.base}${FileRoutePaths.fill(RouteConstants.SEGMENTS.FILES_GRANT_ID, { grantId })}`;
  }
}
