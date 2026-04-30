import { ServerApiUtils } from './server-api';

/**
 * Scans resolved page content for a hero image that should be preloaded
 * as the LCP element. Returns the image URL so the caller can render
 * `<link rel="preload" as="image" fetchPriority="high" href={url} />` in JSX.
 *
 * The RSC renderer intercepts that JSX link element and emits an :HL hint
 * into the streaming payload, which Next.js converts to a literal
 * `<link rel="preload" as="image">` in the initial HTML shell.
 */
export class LcpPreloader {
  static async preloadForContent(content: Record<string, unknown> | null): Promise<string | null> {
    if (!content) return null;

    const blocks = Array.isArray(content.content) ? content.content : [];

    // Check for hero block with a custom CMS-configured logo
    const heroBlock = blocks.find((b: any) => b?.type === 'hero');
    if (heroBlock) {
      const logoUrl = String(heroBlock?.data?.logo || '').trim();
      if (logoUrl) return logoUrl;
    }

    const productBlock = blocks.find(
      (b: any) => b?.type === 'product' && (b?.data?.productSlug || b?.content?.productSlug),
    ) as Record<string, any> | undefined;

    if (productBlock) {
      const productSlug = String(
        productBlock.data?.productSlug || productBlock.content?.productSlug || '',
      ).trim();
      if (productSlug) {
        return LcpPreloader.fetchProductHeroImageUrl(productSlug);
      }
    }
    return null;
  }

  private static async fetchProductHeroImageUrl(productSlug: string): Promise<string | null> {
    try {
      const url = ServerApiUtils.buildPluginPath('ecommerce', `products/${encodeURIComponent(productSlug)}`);
      const product = await ServerApiUtils.serverFetchJson(url) as Record<string, any> | null;
      const imageUrl = String(product?.imageUrl || '').trim();
      return imageUrl || null;
    } catch {
      return null;
    }
  }
}
