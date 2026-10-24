import React from 'react';
import type { ReactElement } from 'react';
import { Bridge, prop } from '@fromcode119/react-class-components';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { NavigationPromisesContext, PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { ConsoleMountUtils } from '@fromcode119/core/utils/console-mount-utils';
import { ConsoleMountContext } from '@/components/view/console-mount-context.client';
import { ConsoleMountRouter } from '@/lib/console-mount/console-mount-router';
import type { IConsoleMountProviderProps } from '@/components/interfaces/console-mount-provider-props.interface';
import type { IConsoleMountProviderValues } from '@/components/interfaces/console-mount-provider-values.interface';

/**
 * Makes a console mounted at a site's console path (`shop.example.com/backend`) behave, for every
 * component below, exactly like a console at the root of its own host.
 *
 * The browser's address carries the mount; the console's routes do not. So, below this provider:
 * - `usePathname()` returns the route (`/settings`, not `/backend/settings`) — active navigation,
 *   catch-all resolution and every `pathname.startsWith(...)` keep working unchanged;
 * - `useRouter()` (and Next's own redirect boundary, which uses it) prefixes the mount on push,
 *   replace and prefetch.
 *
 * `next/link` does NOT navigate through the router context — it dispatches the href directly — so a
 * link's href carries the mount itself (`AdminLink`). In development `usePathname()` reads Next's
 * navigation promises first; they hold the browser address, so they are cleared here and the hook falls
 * back to the context set above.
 *
 * Not mounted: the provider only publishes `''` and changes nothing.
 */
export class ConsoleMountProvider extends Bridge<IConsoleMountProviderValues, IConsoleMountProviderProps> {
  @prop declare mount: string;
  @prop declare children: React.ReactNode;

  protected read(): IConsoleMountProviderValues {
    const router = React.useContext(AppRouterContext);
    const pathname = React.useContext(PathnameContext);
    const mount = this.mount;
    const wrapped = React.useMemo(
      () => (router && mount ? ConsoleMountRouter.wrap(router, mount) : router),
      [router, mount],
    );
    return { router: wrapped, pathname };
  }

  protected present({ router, pathname }: IConsoleMountProviderValues): ReactElement {
    const mount = this.mount || '';
    if (!mount) {
      return <ConsoleMountContext.context.Provider value="">{this.children}</ConsoleMountContext.context.Provider>;
    }
    return (
      <ConsoleMountContext.context.Provider value={mount}>
        <AppRouterContext.Provider value={router}>
          <PathnameContext.Provider value={pathname === null ? null : ConsoleMountUtils.strip(pathname, mount)}>
            <NavigationPromisesContext.Provider value={null}>
              {this.children}
            </NavigationPromisesContext.Provider>
          </PathnameContext.Provider>
        </AppRouterContext.Provider>
      </ConsoleMountContext.context.Provider>
    );
  }
}
