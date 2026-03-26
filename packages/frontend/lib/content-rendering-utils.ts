import { CoercionUtils } from '@fromcode119/core/client';

/**
 * Utilities for rendering content blocks and resolving display metadata.
 */
export class ContentRenderingUtils {
  static shouldBypassDefaultContent(layoutComponent: any, content: any): boolean {
    if (!layoutComponent) {
      return false;
    }

    if (typeof layoutComponent.handlesOwnContent === 'function') {
      return Boolean(layoutComponent.handlesOwnContent(content));
    }

    const slugs = Array.isArray(layoutComponent.handlesOwnContentSlugs)
      ? layoutComponent.handlesOwnContentSlugs
      : [];
    const normalizedSlug = CoercionUtils.toString(content?.slug).trim().toLowerCase();

    return Boolean(normalizedSlug && slugs.map((entry: any) => CoercionUtils.toString(entry).trim().toLowerCase()).includes(normalizedSlug));
  }

  /**
   * Resolves the best display title from content object.
   * Tries content.title, then content.name, with a fallback.
   */
  static resolveDisplayTitle(content: any, fallback = 'Untitled'): string {
    return (
      CoercionUtils.toString(content?.title) ||
      CoercionUtils.toString(content?.name) ||
      fallback
    );
  }

  /**
   * Builds renderable content structure from a content object.
   * Handles direct content, content blocks, and auto-generates product detail blocks for product-like records.
   */
  static buildRenderableContent(content: any): any {
    const directContent = content?.content ?? content?.contentBlocks ?? null;
    const hasStringContent = typeof directContent === 'string' && directContent.trim().length > 0;
    const hasStructuredContent = Array.isArray(directContent)
      ? directContent.length > 0
      : !!(directContent && typeof directContent === 'object' && Object.keys(directContent).length > 0);

    if (hasStringContent || hasStructuredContent) {
      return directContent;
    }

    const slug = CoercionUtils.toString(content?.slug);
    const isProductLike = Boolean(
      slug &&
      (
        content?.price !== undefined ||
        content?.effectivePrice !== undefined ||
        content?.salePrice !== undefined ||
        content?.currency !== undefined ||
        content?.shortDescription !== undefined
      )
    );

    if (!isProductLike) return directContent;

    const normalizedPrefix = CoercionUtils.toString(content?.customPermalink).startsWith('/cosmic-box/')
      ? '/cosmic-box'
      : '/shop';

    return [
      {
        id: `auto-product-detail-${CoercionUtils.toString(content?.id) || slug}`,
        type: 'ecommerce-product-detail',
        data: {
          title: ContentRenderingUtils.resolveDisplayTitle(content),
          slugSource: 'url',
          slugPathPrefix: normalizedPrefix,
          productSlug: slug,
          showDescription: false,
          buttonLabel: 'Добави към количката',
          successMessage: 'Продуктът е добавен в количката.'
        }
      }
    ];
  }
}
