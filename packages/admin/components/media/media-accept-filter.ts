import { CoercionUtils } from '@fromcode119/core/client';
import type { IMediaItem } from '@/components/media/interfaces/media-item.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Which files a media field takes, in the browser's own `accept` syntax: `image/*`, `video/*`,
 * `application/pdf`, comma separated. A field declares it as `admin.accept`; no declaration means every
 * file the library holds, and the picker says so by showing no filter line.
 */
export class MediaAcceptFilter {
  /** What the upload control offers when the field names no types — the formats the library stores. */
  static readonly ANY = 'image/*,video/*,application/pdf';

  private constructor(readonly tokens: string[]) {}

  static from(accept: unknown): MediaAcceptFilter {
    const tokens = CoercionUtils.toString(accept)
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter((token) => /^[a-z0-9.+-]+\/(\*|[a-z0-9.+-]+)$/.test(token));
    return new MediaAcceptFilter(Array.from(new Set(tokens)));
  }

  get active(): boolean {
    return this.tokens.length > 0;
  }

  /** The value the media list endpoint and the upload input both take. */
  get query(): string {
    return this.tokens.join(',');
  }

  get uploadAccept(): string {
    return this.active ? this.query : MediaAcceptFilter.ANY;
  }

  matches(item: IMediaItem): boolean {
    if (!this.active) return true;
    const mime = CoercionUtils.toString(item.mimeType).toLowerCase();
    return this.tokens.some((token) => token.endsWith('/*') ? mime.startsWith(token.slice(0, -1)) : mime === token);
  }

  /** "Images", "Images, PDF" — what the picker states it is showing. */
  get label(): string {
    return this.tokens.map((token) => {
      if (token === 'image/*') return AdminI18n.t('mediaPicker.acceptImages');
      if (token === 'video/*') return AdminI18n.t('mediaPicker.acceptVideos');
      if (token === 'application/pdf') return 'PDF';
      return token;
    }).join(', ');
  }
}
