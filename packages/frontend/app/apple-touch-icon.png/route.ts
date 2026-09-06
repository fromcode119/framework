import { ThemeFaviconRouteResolver } from '@/lib/theme/theme-favicon-route-resolver';
import { ThemeIconRouteService } from '@/lib/theme/theme-icon-route-service';

/**
 * The root layout declares `icons.apple = '/apple-touch-icon.png'`. Without this route that link
 * 404'd on every page (a console error on each load); it now serves the active theme's icon exactly
 * like `/favicon.ico` does, with the same framework fallback.
 */
export class AppleTouchIconRoute {
  static async GET(request: Request) {
    return ThemeIconRouteService.serve(await ThemeFaviconRouteResolver.resolveAppleTouchIcon(), request, 'image/png', 'apple-touch-icon');
  }
}
