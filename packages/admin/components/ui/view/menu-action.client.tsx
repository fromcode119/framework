import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';

/**
 * One row of a menu that something outside the menu adds — an action a plugin offers in a record's ⋯
 * menu. It reads like the menu's own rows: an icon, a label, and an optional second line saying how the
 * last run went. While it runs, the icon turns into a spinner and the row cannot be pressed again.
 * The look is `admin.css` (`fc-menu-action*`).
 */
export class MenuAction extends PureReactor {
  @prop declare label: string;
  @prop declare onClick: () => void;
  @prop declare icon?: ReactNode;
  /** A second line under the label: the outcome of the last run, or what the action will do. */
  @prop declare detail?: string;
  @prop declare isLoading?: boolean;
  @prop declare danger?: boolean;

  render(): ReactNode {
    const row = AdminClass.of('menu-action');
    return (
      <button type="button" className={row} data-danger={this.danger ? 'true' : undefined}
        onClick={this.onClick} disabled={this.isLoading} aria-busy={this.isLoading || undefined} title={this.label}>
        <span className={`${row}__icon`}>{this.isLoading ? <FrameworkIcons.Loader size={15} /> : this.icon}</span>
        <span className={`${row}__text`}>
          <span className={`${row}__label`}>{this.label}</span>
          {this.detail ? <span className={`${row}__detail`}>{this.detail}</span> : null}
        </span>
      </button>
    );
  }
}
