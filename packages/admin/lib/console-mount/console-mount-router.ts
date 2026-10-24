import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { ConsoleMountUtils } from '@fromcode119/core/utils/console-mount-utils';

/**
 * Next's app router, with the console mount put in front of every address it is asked to go to.
 *
 * The console's routes know nothing of the mount (the gateway strips it), so code pushes `/settings`;
 * the browser must go to `/backend/settings`, which the gateway turns back into `/settings`. The prefix
 * is idempotent, so an address a plugin already built under the mount is passed through unchanged.
 */
export class ConsoleMountRouter {
  static wrap(router: AppRouterInstance, mount: string): AppRouterInstance {
    return {
      ...router,
      push: (href, options) => router.push(ConsoleMountUtils.prefix(href, mount), options),
      replace: (href, options) => router.replace(ConsoleMountUtils.prefix(href, mount), options),
      prefetch: (href, options) => router.prefetch(ConsoleMountUtils.prefix(href, mount), options),
    };
  }
}
