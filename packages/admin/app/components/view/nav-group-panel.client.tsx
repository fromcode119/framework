import type { ReactNode } from 'react';
import { PureReactor, prop, state } from '@fromcode119/react-class-components';

/**
 * A sub-menu's pages as a second column beside the menu (desktop).
 *
 * It is drawn into the column the shell keeps right after the menu (`#fc-nav-second`): IN the layout
 * while the open page is one of the group's, so the content moves over for it; OVER the content while
 * the pointer is on another group, to look before going there. Below the desktop width the column does
 * not exist and the menu draws the same pages under the group instead (see admin.css).
 */
export class NavGroupPanel extends PureReactor {
  static readonly ROOT_ID = 'fc-nav-second';

  @prop declare title: string;
  @prop declare preview: boolean;
  @prop declare onPointerEnter?: () => void;
  @prop declare onPointerLeave?: () => void;
  @prop declare children?: ReactNode;

  @state private root: HTMLElement | null = null;

  componentDidMount(): void {
    this.root = document.getElementById(NavGroupPanel.ROOT_ID);
  }

  render(): ReactNode {
    if (!this.root) return null;
    return this.portal(
      <nav
        className={`fc-nav-panel${this.preview ? ' fc-nav-panel--preview' : ''}`}
        aria-label={this.title}
        onMouseEnter={this.onPointerEnter}
        onMouseLeave={this.onPointerLeave}
      >
        <p className="fc-nav-panel__title">{this.title}</p>
        <div className="fc-nav-panel__list">{this.children}</div>
      </nav>,
      this.root,
    );
  }
}
