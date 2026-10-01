import { InjectionTarget } from '@core/enums/injection-target.enum';
import type { IStorefrontNotice } from '@core/storefront-notice/interfaces/storefront-notice.interface';
import type { IStorefrontNoticeOptions } from '@core/storefront-notice/interfaces/storefront-notice-options.interface';

/**
 * The `context.ui` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextUi {
  registerHeadInjection(injection: {
    tag: string;
    props: Record<string, any>;
    content?: string;
    target?: InjectionTarget;
  }): void;

  /**
   * The address that sends a visitor to `path` on THIS site with a one-time message — for a redirect
   * after something the visitor did from outside the site (a link in an email). `path` is a path on the
   * site (`/`, `/newsletter/confirmed`), never a URL: the framework builds the host, so this cannot be
   * turned into a redirect to somewhere else. The words are shown as given — word them in the site's
   * language (`context.i18n`). See StorefrontNoticeTokens.
   */
  noticeUrl(path: string, notice: IStorefrontNotice, options?: IStorefrontNoticeOptions): Promise<string>;
}
