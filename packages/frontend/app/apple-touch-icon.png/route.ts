import { SiteIconRouteService } from '@/lib/theme/site-icon-route-service';

/**
 * The root layout declares `icons.apple = '/apple-touch-icon.png'`. Without this route that link
 * 404'd on every page (a console error on each load); it serves the site's icon exactly like
 * `/favicon.ico` does, with the same platform fallback — see SiteIconRouteService.
 */
export class AppleTouchIconRoute {
  static async GET() {
    return SiteIconRouteService.serve((icon) => icon.appleTouchIcon, 'apple-touch-icon');
  }
}
