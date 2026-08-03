import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/reactor';

export class RootFramework extends Reactor {
  @prop declare children: ReactNode;
  @prop declare containerId?: string;

  @state container: HTMLElement | null = null;
  private createdContainer = false;

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
    let element = document.getElementById(containerId);
    if (!element) {
      element = document.createElement('div');
      element.id = containerId;
      document.body.appendChild(element);
      this.createdContainer = true;
    }

    this.container = element;
  }

  private detachContainer(): void {
    if (this.createdContainer && this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.createdContainer = false;
    this.container = null;
  }
}
