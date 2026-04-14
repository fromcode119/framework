export class ResolvedDocResponseService {
  static normalizeResult(result: { type?: unknown; plugin?: unknown; doc?: unknown } | null): {
    type: string;
    plugin: string;
    doc: Record<string, unknown> | null;
  } | null {
    if (!result) {
      return null;
    }

    return {
      type: String(result.type || '').trim(),
      plugin: String(result.plugin || '').trim(),
      doc: this.normalizeDoc(this.toRecord(result.doc)),
    };
  }

  static normalizeDoc(doc: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!doc) {
      return null;
    }

    const normalized = { ...doc };
    const themeLayout = this.readString(doc.themeLayout) || this.readString(doc.pageTemplate) || this.readString(doc.page_template);
    const content = doc.content ?? doc.contentBlocks ?? null;

    if (themeLayout) {
      normalized.themeLayout = themeLayout;
    }

    if (content !== null && content !== undefined) {
      normalized.content = content;
    }

    return normalized;
  }

  private static toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private static readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}