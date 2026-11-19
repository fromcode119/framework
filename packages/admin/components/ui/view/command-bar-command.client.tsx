import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/** One thing the bar can do. A line stands before each, so the bar reads as a row of separate actions. */
export class CommandBarCommand extends PureReactor {
  @prop declare label: ReactNode;
  @prop declare onClick: () => void;
  @prop declare icon?: ReactNode;
  @prop declare disabled?: boolean;
  /** For a command drawn as an icon alone. */
  @prop declare title?: string;

  render(): ReactNode {
    const name = AdminClass.of('command-bar');
    return (
      <>
        <span className={`${name}__separator`} aria-hidden="true" />
        <button type="button" className={`${name}__command`} onClick={this.onClick} disabled={this.disabled} title={this.title} aria-label={this.title}>
          {this.icon}
          {this.label}
        </button>
      </>
    );
  }
}
