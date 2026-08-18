import type { IAccountFile } from '@react/account/interfaces/account-file.interface';

/**
 * One heading with its files — a lesson, an order, a share.
 *
 * Every source normalises to this shape, which is what makes one panel possible. The two existing
 * panels disagreed on exactly one thing: one source hands back a ready path while another built its URL in
 * the browser from `(orderId, productId, name)`. Requiring a ready `href` settles it — the owner of the
 * entitlement builds the link, because only it knows how its own route is addressed.
 */
export interface IAccountFileGroup {
  /** e.g. the lesson title, the product name, the share title. */
  title: string;
  /** Optional second line: the course, the order number, who sent it. */
  subtitle?: string;
  /**
   * Optional state marker — a drip lock, an expiring link. Kept generic so the panel needs no
   * knowledge of what any plugin's states mean.
   */
  badge?: { label: string; tone?: 'neutral' | 'warning' };
  files: IAccountFile[];
}
