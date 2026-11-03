import { SiteIconRouteService } from '@/lib/theme/site-icon-route-service';

/** Serves the site's favicon — see SiteIconRouteService. */
export class FaviconRoute {
  static async GET() {
    return SiteIconRouteService.serve((icon) => icon.favicon, 'favicon');
  }
}
