import { CoercionUtils } from '@fromcode119/core/client';
import { RenderableContentTransformerRegistry } from '../../react/src/renderable-content-transformer-registry';

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
   * Handles direct content and delegates plugin-specific adaptation to registered transformers.
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

    return RenderableContentTransformerRegistry.transform(content, directContent);
  }
}
