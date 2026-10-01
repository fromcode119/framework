import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { IStorefrontNotice } from '@core/storefront-notice/interfaces/storefront-notice.interface';
import type { IStorefrontNoticeOptions } from '@core/storefront-notice/interfaces/storefront-notice-options.interface';
import { StorefrontNoticeTokens } from '@core/storefront-notice/storefront-notice-tokens';
import { StorefrontNoticeDisplay } from '@core/storefront-notice/storefront-notice-display';
import { StorefrontNoticeParam } from '@core/storefront-notice/storefront-notice-param';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { SiteBaseUrl } from '@core/tenant/site-base-url';

export class UiContextProxy {
  static createUiProxy(
  plugin: ILoadedPlugin,
  manager: IPluginManagerInterface
) {
      return {
        registerHeadInjection: (injection: any) => {
          const slug = plugin.manifest.slug;
          const injections = manager.headInjections.get(slug) || [];

          const existingIndex = injections.findIndex(inj => {
            if (inj.tag !== injection.tag) return false;
            if (injection.props.id && inj.props.id === injection.props.id) return true;
            if (injection.props.name && inj.props.name === injection.props.name) return true;
            if (injection.props.src && inj.props.src === injection.props.src) return true;
            if (injection.props.href && inj.props.href === injection.props.href) return true;
            return false;
          });

          if (existingIndex >= 0) {
            injections[existingIndex] = injection;
          } else {
            injections.push(injection);
          }
          manager.headInjections.set(slug, injections);
        },
        noticeUrl: (path: string, notice: IStorefrontNotice, options?: IStorefrontNoticeOptions) =>
          UiContextProxy.noticeUrl(manager, path, notice, options),
      };

  }

  /** See IPluginContextUi.noticeUrl. */
  static async noticeUrl(manager: IPluginManagerInterface, path: string, notice: IStorefrontNotice, options?: IStorefrontNoticeOptions): Promise<string> {
    const target = String(path ?? '').trim();
    // A path on the site and nothing else: `//host` and `https://…` would make this an open redirect.
    if (!target.startsWith('/') || target.startsWith('//') || /[\s\\]/.test(target)) {
      throw new Error(`context.ui.noticeUrl takes a path on the site, not "${target}"`);
    }
    const display = StorefrontNoticeDisplay.parse(options?.display ?? StorefrontNoticeDisplay.BAR.value);
    if (!display) throw new Error(`context.ui.noticeUrl: unknown display "${String(options?.display)}"`);
    const token = await new StorefrontNoticeTokens(manager).mint(notice, display, options?.ttlSeconds);
    const base = await SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP);
    const url = ApplicationUrlUtils.joinApiPath(base, target);
    return `${url}${url.includes('?') ? '&' : '?'}${StorefrontNoticeParam.NAME}=${encodeURIComponent(token)}`;
  }
}
