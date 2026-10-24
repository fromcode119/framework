import NextLink from 'next/link';
import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/react-class-components';
import { ConsoleMountUtils } from '@fromcode119/core/utils/console-mount-utils';
import { ConsoleMountContext } from '@/components/view/console-mount-context.client';
import type { IAdminLinkProps } from '@/components/interfaces/admin-link-props.interface';

/**
 * `next/link` for the console. Use it for every in-console link.
 *
 * `next/link` navigates by dispatching its href straight into Next's router state; it never goes
 * through the router context `ConsoleMountProvider` wraps. On a console mounted at a site's console
 * path (`shop.example.com/backend`) a plain `<Link href="/settings">` would therefore leave the console
 * for the storefront's `/settings`. This puts the mount in front of the href (an object href's
 * `pathname` included) and is otherwise the same link. Not mounted, the href is passed unchanged.
 */
export class AdminLink extends PureReactor<IAdminLinkProps> {
  static contextType = ConsoleMountContext.context;
  declare context: string;

  private get href(): IAdminLinkProps['href'] {
    const { href } = this.props;
    const mount = this.context;
    if (!mount) return href;
    if (typeof href === 'string') return ConsoleMountUtils.prefix(href, mount);
    return href.pathname ? { ...href, pathname: ConsoleMountUtils.prefix(href.pathname, mount) } : href;
  }

  render(): ReactNode {
    return <NextLink {...this.props} href={this.href} />;
  }
}
