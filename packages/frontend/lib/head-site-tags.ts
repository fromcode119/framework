import type { Metadata } from 'next';
import type { IHeadData } from '@/lib/interfaces/head-data.interface';

/**
 * The site-wide head tags a head-data provider may state beyond title and share cards: meta keywords,
 * search-engine ownership checks, a social app id, and whether Twitter cards are wanted at all.
 * They belong in the server-rendered head — an ownership check is read from the raw HTML and is never
 * seen if it is only added by script after load. Absent fields add nothing.
 */
export class HeadSiteTags {
  /** `<meta name="keywords">`, from a comma-separated string. */
  static keywords(head: IHeadData | null): string[] | undefined {
    const words = String(head?.keywords || '').split(',').map((word) => word.trim()).filter(Boolean);
    return words.length > 0 ? words : undefined;
  }

  /** Google's own metadata field, and the Bing/Yandex-style ones as named meta tags. */
  static verification(head: IHeadData | null): Metadata['verification'] | undefined {
    const google = String(head?.googleVerification || '').trim();
    const bing = String(head?.bingVerification || '').trim();
    if (!google && !bing) return undefined;
    return { ...(google ? { google } : {}), ...(bing ? { other: { 'msvalidate.01': bing } } : {}) };
  }

  /** Named meta tags with no field of their own in Next's metadata. */
  static other(head: IHeadData | null): Record<string, string> {
    const appId = String(head?.facebookAppId || '').trim();
    return appId ? { 'fb:app_id': appId } : {};
  }

  /** Everything above in one object, for spreading into a page's or the site's metadata (`other` keeps what is already there). */
  static fields(head: IHeadData | null, other?: Metadata['other']): Pick<Metadata, 'keywords' | 'verification' | 'other'> {
    return { keywords: HeadSiteTags.keywords(head), verification: HeadSiteTags.verification(head), other: { ...other, ...HeadSiteTags.other(head) } };
  }

  /** The Twitter card, or nothing when the provider says the site does not want one. */
  static twitter(head: IHeadData | null, card: string | undefined, fields: { title?: string; description?: string; images?: string[]; site?: string }): Metadata['twitter'] | undefined {
    if (head?.twitterCardsEnabled === false) return undefined;
    // The card vocabulary is Next's, taken from its own metadata type rather than restated.
    return { card: (card || 'summary_large_image') as NonNullable<Metadata['twitter']> extends { card: infer C } ? C : never, ...fields };
  }
}
