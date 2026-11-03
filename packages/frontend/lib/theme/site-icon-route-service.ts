import { NextResponse } from 'next/server';
import { SiteIcon, SiteIconChoice } from '@fromcode119/core/client';
import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { FrontendPublicFile } from '@/lib/theme/frontend-public-file';

/**
 * Serves a site icon (`/favicon.ico`, `/apple-touch-icon.png`) — the file `/system/frontend` names
 * (`siteIcon`: the one picked in Settings → General, else the active theme's own), else the
 * platform's mark, else 204, so an icon the root layout declares never 404s.
 *
 * A named file is a REDIRECT to its own address on this host, not bytes fetched and copied: an upload
 * lives at `/uploads/…`, which is not an api route, and the browser then caches the file under its
 * own long-lived headers. The redirect itself is kept short, so a newly picked icon shows within the hour.
 */
export class SiteIconRouteService {
  static readonly PLATFORM_MARK = '/brand/atlantis-mark-indigo.png';
  private static readonly REDIRECT_CACHE = 'public, max-age=3600';
  private static readonly FILE_CACHE = 'public, max-age=86400';

  static async serve(pick: (icon: SiteIcon) => SiteIconChoice, logLabel: string): Promise<NextResponse> {
    try {
      const choice = pick(SiteIcon.from((await FrontendConfigCache.read())?.siteIcon));
      if (!choice.isPlatform) {
        return new NextResponse(null, { status: 302, headers: { Location: choice.path, 'Cache-Control': SiteIconRouteService.REDIRECT_CACHE } });
      }
    } catch (error) {
      console.error(`[frontend/${logLabel}] Failed to resolve the site icon:`, error);
    }
    return SiteIconRouteService.platformMark();
  }

  /** Read from disk, never fetched from this server's own public URL — from inside the container that failed. */
  private static async platformMark(): Promise<NextResponse> {
    const mark = await FrontendPublicFile.read(SiteIconRouteService.PLATFORM_MARK);
    if (!mark) return new NextResponse(null, { status: 204, headers: { 'Cache-Control': SiteIconRouteService.FILE_CACHE } });
    return new NextResponse(new Uint8Array(mark), {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': SiteIconRouteService.FILE_CACHE },
    });
  }
}
