import type { ReactNode } from 'react';
import Link from 'next/link';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop } from '@fromcode119/react-class-components';
import { SidebarMenuService } from '@/app/services/sidebar-menu-service';
import { AdminPageAccessService } from '@/app/services/admin-page-access-service';

/**
 * Every admin page, refused to a user whose role does not open it.
 *
 * The menu already hides such a page; a bookmark or a typed URL still opened it, and every request it
 * made was then refused, so it rendered its own "could not be loaded" — a claim about the data, when
 * the truth is about the user's role. Worse on framework pages: a staff member could open the whole
 * "Create new role" form. This says so, names the permission, and offers the user's own first screen.
 *
 * Mounted once around the page content by the shell, so no page can forget it.
 */
export class PagePermissionGate extends AdminComponent {
  declare props: Pick<PagePermissionGate, 'children'>;

  @prop declare children: ReactNode;

  render(): ReactNode {
    const menuItems = this.runtime.plugins?.menuItems ?? [];
    const user = this.auth?.user;
    const path = this.pathname;
    if (!user || user.roles?.includes('admin')) return this.children;
    // Every console's menu carries the framework's own items, so an empty one has not arrived yet.
    // Deciding now would refuse a plugin page for a moment, or show a framework form before refusing it.
    if (menuItems.length === 0) return null;
    if (AdminPageAccessService.isAllowed(path, menuItems, user)) return this.children;
    const required = AdminPageAccessService.requiredFor(path, menuItems, user);
    const home = SidebarMenuService.homePathFor(menuItems, user);
    return (
      <div className="fc-scope-notice">
        <span className="fc-scope-notice__text">
          {required === '*'
            ? 'This page is for administrators. Your role does not include it.'
            : <>Your role does not include this page (it needs <code>{required}</code>).</>}{' '}
          {home ? <Link href={home}>Open your own page instead.</Link> : null}
        </span>
      </div>
    );
  }
}
