import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminLink } from '@/components/view/admin-link.client';

/** The head of a menu that belongs to one place (the settings): the place's name, and the way back out of it. */
export class SidebarNavBack extends PureReactor {
  @prop declare label: string;
  @prop declare href: string;
  @prop declare onClick?: () => void;

  render(): ReactNode {
    return (
      <AdminLink href={this.href} onClick={this.onClick} className="fc-nav-back">
        <FrameworkIcons.Left size={15} />
        <span>{this.label}</span>
      </AdminLink>
    );
  }
}
