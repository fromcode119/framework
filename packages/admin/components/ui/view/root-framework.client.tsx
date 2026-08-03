import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/reactor';

export class RootFramework extends Reactor {
  @prop declare children: ReactNode;
  @prop declare containerId?: string;

  @state container: HTMLElement | null = null;

  private created = false;
  private element: HTMLElement | null = null;

  componentDidMount(): void {
    const containerId = this.containerId ?? 'portal-root';
    let element = document.getElementById(containerId);

    if (!element) {
      element = document.createElement('div');
      element.id = containerId;
      document.body.appendChild(element);
      this.created = true;
    }

    this.element = element;
    this.container = element;
  }

  componentWillUnmount(): void {
    if (this.created && this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  render(): ReactNode {
    if (!this.container) return null;
    return this.portal(this.children, this.container);
  }
}
