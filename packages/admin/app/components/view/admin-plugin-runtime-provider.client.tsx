import type { ReactNode } from 'react';
import { PluginRuntimeProvider } from '@fromcode119/react';
import { RuntimeLocationUtils } from '@fromcode119/core/client';
import { Platform, bound, prop } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';

/**
 * Hands the admin's router to the plugin runtime, so a plugin page's own buttons can navigate.
 *
 * Without this the plugin runtime had no navigator at all and plugin pages could not move the user
 * anywhere — Hub's Edit/Add buttons were written against a `router` member that does not exist on
 * PluginComponent and silently did nothing.
 *
 * Two things are added here rather than in the framework-agnostic provider, because both are the
 * ADMIN's knowledge: the App Router instance (`@fromcode119/react` deliberately has no Next
 * dependency, since themes share it), and the admin base prefix — a plugin asks for `/hub/rates/3`
 * and it is this layer that knows whether the console is served at `/` or under `/admin`.
 *
 * It reads the router from the admin runtime CONTEXT, not from `useRouter`, so it stays a hook-free
 * class like the rest of the admin.
 */
export class AdminPluginRuntimeProvider extends AdminComponent {
  @prop declare children: ReactNode;

  @bound private navigate(path: string, options?: { replace?: boolean }): void {
    const router = this.runtime?.router;
    const target = RuntimeLocationUtils.toAdminPath(path);
    if (!router) {
      // The provider's own fallback would navigate to the UNPREFIXED path, which is a different page.
      // Better to do the full load with the right URL than a fast one to the wrong place.
      if (Platform.hasWindow) window.location.assign(target);
      return;
    }
    if (options?.replace) router.replace(target);
    else router.push(target);
  }

  render(): ReactNode {
    return <PluginRuntimeProvider navigate={this.navigate}>{this.children}</PluginRuntimeProvider>;
  }
}
