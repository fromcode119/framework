import { connection } from 'next/server';
import { AppearanceAssetService } from '@/app/services/appearance-asset-service';

/** Serves an installed appearance's runtime bundle/assets from the mounted `appearance/` directory. */
export class AppearanceUiRoute {
  static async GET(
    _req: Request,
    ctx: { params: Promise<{ slug: string; path: string[] }> },
  ): Promise<Response> {
    // Opt into dynamic rendering without a route-segment `export const`.
    await connection();
    const { slug, path } = await ctx.params;
    return AppearanceAssetService.serve(slug, path ?? []);
  }
}
