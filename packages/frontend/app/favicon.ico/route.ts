import { ThemeFaviconRouteResolver } from '@/lib/theme/theme-favicon-route-resolver';
import { ThemeIconRouteService } from '@/lib/theme/theme-icon-route-service';

/** Serves the active theme's favicon, falling back to the framework default. */
export class FaviconRoute {
  static async GET(request: Request) {
    return ThemeIconRouteService.serve(await ThemeFaviconRouteResolver.resolve(), request, 'image/x-icon', 'favicon');
  }
}
