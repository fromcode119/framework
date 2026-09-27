import type { ReactNode } from 'react';
import Link from 'next/link';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop } from '@fromcode119/react-class-components';
import { SidebarMenuService } from '@/app/services/sidebar-menu-service';

/**
 * A plugin page whose menu item asks for a permission the user does not hold.
 *
 * The menu already hides such a page; a bookmark or a typed URL still opens it, and every request it
 * makes is then refused, so it used to render its own "could not be loaded" — a claim about the
 * data, when the truth is about the user's role. This says so, and offers the user's own first screen.
 */
export class MenuPermissionGate extends AdminComponent {
  declare props: Pick<MenuPermissionGate, 'path' | 'children'>;

  /** The page's menu path: `/<plugin>` or `/<plugin>/<page>`. */
  @prop declare path: string;
  @prop declare children: ReactNode;

  render(): ReactNode {
    const menuItems = this.runtime.plugins?.menuItems ?? [];
    const user = this.auth?.user;
    if (!SidebarMenuService.isWithheld(menuItems, this.path, user)) return this.children;
    const home = SidebarMenuService.homePathFor(menuItems, user);
    return (
      <div className="fc-scope-notice">
        <span className="fc-scope-notice__text">
          Your role does not include {this.path}.{' '}
          {home ? <Link href={home}>Open your own page instead.</Link> : null}
        </span>
      </div>
    );
  }
}
