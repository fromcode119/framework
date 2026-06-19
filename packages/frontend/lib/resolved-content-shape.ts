export class ResolvedContentShape {
  static normalize(content: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!content) {
      return null;
    }

    const normalized = { ...content };
    const layoutName = this.resolveLayoutName(content);
    const resolvedContent = this.resolveContent(content);

    if (layoutName) {
      normalized.themeLayout = layoutName;
    }

    const styleVariant = this.resolveStyleVariant(content);
    if (styleVariant) {
      normalized.styleVariant = styleVariant;
    }

    if (resolvedContent !== null) {
      normalized.content = resolvedContent;
    }

    return normalized;
  }

  static resolveSlug(content: Record<string, unknown> | null): string {
    return this.readString(content, ['slug']);
  }

  static resolveTitle(content: Record<string, unknown> | null): string {
    return this.readString(content, ['title', 'name']);
  }

  static resolveLayoutName(content: Record<string, unknown> | null): string {
    // CANONICAL camelCase only. Products historically used `pageTemplate`, CMS pages use
    // `themeLayout`; both are camelCase. The snake_case `page_template` was a DEAD read —
    // the DB proxy denormalizes every row to camelCase, so that key never exists.
    return this.readString(content, ['themeLayout', 'pageTemplate']);
  }

  static resolveStyleVariant(content: Record<string, unknown> | null): string {
    return this.readString(content, ['styleVariant']);
  }

  static resolveContent(content: Record<string, unknown> | null): unknown | null {
    if (!content) {
      return null;
    }

    if (content.content !== undefined && content.content !== null) {
      return content.content;
    }

    return null;
  }

  static hasRenderableContent(content: Record<string, unknown> | null): boolean {
    const resolvedContent = this.resolveContent(content);
    if (typeof resolvedContent === 'string') {
      return resolvedContent.trim().length > 0;
    }

    if (Array.isArray(resolvedContent)) {
      return resolvedContent.length > 0;
    }

    return Boolean(
      resolvedContent
      && typeof resolvedContent === 'object'
      && Object.keys(resolvedContent as Record<string, unknown>).length > 0
    );
  }

  private static readString(content: Record<string, unknown> | null, keys: string[]): string {
    if (!content) {
      return '';
    }

    for (const key of keys) {
      const value = content[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }
}