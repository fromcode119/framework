export class ResolvedDocResponseService {
  static normalizeResult(result: { type?: unknown; plugin?: unknown; doc?: unknown; redirect?: unknown } | null): {
    type: string;
    plugin: string;
    doc: Record<string, unknown> | null;
    redirect?: { target: string; permanent: boolean };
  } | null {
    if (!result) {
      return null;
    }

    const normalized: {
      type: string;
      plugin: string;
      doc: Record<string, unknown> | null;
      redirect?: { target: string; permanent: boolean };
    } = {
      type: String(result.type || '').trim(),
      plugin: String(result.plugin || '').trim(),
      doc: this.normalizeDoc(this.toRecord(result.doc)),
    };

    const redirect = this.toRecord(result.redirect);
    if (redirect && this.readString(redirect.target)) {
      normalized.redirect = {
        target: this.readString(redirect.target),
        permanent: redirect.permanent === true,
      };
    }

    return normalized;
  }

  static normalizeDoc(doc: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!doc) {
      return null;
    }

    const normalized = { ...doc };
    const themeLayout = this.readString(doc.themeLayout) || this.readString(doc.pageTemplate);
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