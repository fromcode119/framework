import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AdminIndexingPolicy } from '@/lib/admin-indexing-policy';

/**
 * Tells crawlers what to do with this console, on every response.
 *
 * A header rather than only a `robots.txt`, because the two answer different questions: robots.txt
 * asks a crawler not to FETCH, and `X-Robots-Tag` tells one that already has the page not to INDEX
 * it. A console reachable through a link somebody pasted needs the second.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (!(await AdminIndexingPolicy.allowed())) {
    response.headers.set('X-Robots-Tag', AdminIndexingPolicy.REFUSE);
  }
  return response;
}

export const config = {
  // Everything the admin serves, including its own assets — a crawler that indexes a chunk file
  // still indexes this host. `robots.txt` is excluded because it must answer for itself.
  matcher: ['/((?!robots.txt).*)'],
};
