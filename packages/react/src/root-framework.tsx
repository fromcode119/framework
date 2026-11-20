import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/react-class-components';

/**
 * Draws its children over the page, in a host of its own inside the shared portal root.
 *
 * Every overlay used to portal straight INTO the shared root, and whichever one created that root also
 * removed it when it unmounted. A short-lived overlay (a menu) could therefore create the root, close,
 * and take it out of the document while a dialog opened later still portalled into it: the dialog was
 * rendered, open and focused, but into a node no longer on the page, so nothing appeared. The root is
 * now never removed, and each overlay adds and removes only its own host, in the order they open, so a
 * dialog opened from another one is drawn above it.
 */
export class RootFramework extends Reactor {
  @prop declare children: ReactNode;
  @prop declare containerId?: string;

  @state container: HTMLElement | null = null;

  private get targetId(): string {
    return this.containerId || 'portal-root';
  }

  componentDidMount(): void {
    this.attachContainer(this.targetId);
  }

  componentDidUpdate(prevProps: Record<string, unknown>): void {
    const previousContainerId = (prevProps.containerId as string) || 'portal-root';
    if (this.targetId !== previousContainerId) {
      this.detachContainer();
      this.attachContainer(this.targetId);
    }
  }

  componentWillUnmount(): void {
    this.detachContainer();
  }

  render(): ReactNode {
    return this.container ? this.portal(this.children, this.container) : null;
  }

  private attachContainer(containerId: string): void {
    let root = document.getElementById(containerId);
    if (!root) {
      root = document.createElement('div');
      root.id = containerId;
      document.body.appendChild(root);
    }
    const host = document.createElement('div');
    root.appendChild(host);
    this.container = host;
  }

  private detachContainer(): void {
    this.container?.remove();
    this.container = null;
  }
}
