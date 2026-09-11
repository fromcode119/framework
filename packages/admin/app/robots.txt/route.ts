import { NextResponse } from 'next/server';
import { AdminIndexingPolicy } from '@/lib/admin-indexing-policy';

/**
 * `robots.txt` for the admin console.
 *
 * There was none, so the answer to "may I crawl this?" was whatever the crawler assumed. Now it is
 * whatever the operator set in Settings → General, and the default is no.
 *
 * A route handler rather than Next's `robots.ts` metadata convention on purpose: that one is
 * PRERENDERED at build time, which would have frozen the answer into the image and made the setting
 * a control that writes a value nothing reads. This is evaluated per request, and says `no-store` so
 * nothing in front of it can freeze it either.
 */
export class AdminRobotsRoute {
  /**
   * Never prerendered. The body depends on a setting an operator changes at runtime, and a build-time
   * answer baked into the image would make that setting a control nothing reads.
   */
  static readonly dynamic = 'force-dynamic';

  static async GET(): Promise<NextResponse> {
    const allowed = await AdminIndexingPolicy.allowed();
    const body = allowed
      ? 'User-agent: *\nAllow: /\n'
      : 'User-agent: *\nDisallow: /\n';

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}
