export class FrontendAssetVersionUrlService {
  static appendVersion(url: string, version: unknown): string {
    const resolvedUrl = String(url || '').trim();
    const resolvedVersion = String(version || '').trim();
    if (!resolvedUrl || !resolvedVersion) {
      return resolvedUrl;
    }

    try {
      const parsed = new URL(resolvedUrl);
      if (!parsed.searchParams.has('v')) {
        parsed.searchParams.set('v', resolvedVersion);
      }
      return parsed.toString();
    } catch {
      const separator = resolvedUrl.includes('?') ? '&' : '?';
      return resolvedUrl.includes('v=') ? resolvedUrl : `${resolvedUrl}${separator}v=${encodeURIComponent(resolvedVersion)}`;
    }
  }
}
