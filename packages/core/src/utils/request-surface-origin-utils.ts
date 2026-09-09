export class RequestSurfaceOriginUtils {
  static hasAdminOriginSignal(
    requestLike: {
      headers?: Record<string, unknown>;
      get?: (name: string) => string | undefined;
    },
    readHeader: (requestLike: {
      headers?: Record<string, unknown>;
      get?: (name: string) => string | undefined;
    }, headerName: string) => string,
    readAbsoluteUrl: (value: unknown) => URL | null,
    isAdminAbsoluteUrl: (url: URL) => boolean,
  ): boolean {
    return RequestSurfaceOriginUtils.readAbsoluteUrlCandidates(requestLike, readHeader, readAbsoluteUrl)
      .some((url) => isAdminAbsoluteUrl(url));
  }

  static hasFrontendOriginSignal(
    requestLike: {
      headers?: Record<string, unknown>;
      get?: (name: string) => string | undefined;
    },
    readHeader: (requestLike: {
      headers?: Record<string, unknown>;
      get?: (name: string) => string | undefined;
    }, headerName: string) => string,
    readAbsoluteUrl: (value: unknown) => URL | null,
    isFrontendAbsoluteUrl: (url: URL) => boolean,
  ): boolean {
    return RequestSurfaceOriginUtils.readAbsoluteUrlCandidates(requestLike, readHeader, readAbsoluteUrl)
      .some((url) => isFrontendAbsoluteUrl(url));
  }

  static readAbsoluteUrlCandidates(
    requestLike: {
      headers?: Record<string, unknown>;
      get?: (name: string) => string | undefined;
    },
    readHeader: (requestLike: {
      headers?: Record<string, unknown>;
      get?: (name: string) => string | undefined;
    }, headerName: string) => string,
    readAbsoluteUrl: (value: unknown) => URL | null,
  ): URL[] {
    const values = [
      readHeader(requestLike, 'origin'),
      readHeader(requestLike, 'referer'),
    ];

    const seen = new Set<string>();
    const urls: URL[] = [];
    for (const value of values) {
      const parsed = readAbsoluteUrl(value);
      if (!parsed) {
        continue;
      }

      const key = parsed.toString();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      urls.push(parsed);
    }

    return urls;
  }
}