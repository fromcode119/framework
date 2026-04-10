import type { Metadata } from 'next';

export class ResolvedContentMetadata {
  static build(content: Record<string, unknown> | null, resolutionType?: string): Metadata {
    const title = ResolvedContentMetadata.resolveTitle(content) || undefined;
    const description = ResolvedContentMetadata.resolveDescription(content) || undefined;
    const other = ResolvedContentMetadata.buildOtherMetadata(content, resolutionType);

    return {
      title,
      description,
      other,
    };
  }

  private static buildOtherMetadata(
    content: Record<string, unknown> | null,
    resolutionType?: string,
  ): Record<string, string> | undefined {
    const contentType = ResolvedContentMetadata.resolveContentType(content, resolutionType);
    const contentId = ResolvedContentMetadata.resolveContentId(content);
    const other: Record<string, string> = {};

    if (contentType) {
      other['fromcode:resolved-type'] = contentType;
    }

    if (contentId) {
      other['fromcode:resolved-id'] = contentId;
    }

    return Object.keys(other).length > 0 ? other : undefined;
  }

  private static resolveContentId(content: Record<string, unknown> | null): string {
    const rawId = content?.id;
    if (typeof rawId === 'number' && Number.isFinite(rawId)) {
      return String(rawId);
    }

    if (typeof rawId === 'string') {
      return rawId.trim();
    }

    return '';
  }

  private static resolveContentType(content: Record<string, unknown> | null, resolutionType?: string): string {
    const rawType = String(resolutionType || content?.contentType || content?.type || '').trim();
    return rawType.toLowerCase();
  }

  private static resolveTitle(content: Record<string, unknown> | null): string {
    return String(
      content?.title ??
      content?.name ??
      '',
    ).trim();
  }

  private static resolveDescription(content: Record<string, unknown> | null): string {
    return String(
      content?.description ??
      content?.excerpt ??
      '',
    ).trim();
  }
}