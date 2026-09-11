import type { MetadataRoute } from 'next';
import { AdminIndexingPolicy } from '@/lib/admin-indexing-policy';

/**
 * `robots.txt` for the admin host.
 *
 * There was none, so the answer to "may I crawl this console?" was whatever the crawler assumed.
 * Now it is whatever the operator set, and the default is no.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const allowed = await AdminIndexingPolicy.allowed();
  return {
    rules: allowed
      ? [{ userAgent: '*', allow: '/' }]
      : [{ userAgent: '*', disallow: '/' }],
  };
}
