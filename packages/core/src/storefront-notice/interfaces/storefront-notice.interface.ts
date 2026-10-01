/** One message for one visitor, already worded in the site's language by whoever raised it. */
export interface IStorefrontNotice {
  /** `success` | `info` | `error` — see StorefrontNoticeTone. */
  tone: string;
  title: string;
  body?: string;
}
