import { AppearanceAssetService } from '@/app/services/appearance-asset-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; path: string[] }> },
): Promise<Response> {
  const { slug, path } = await ctx.params;
  return AppearanceAssetService.serve(slug, path ?? []);
}
