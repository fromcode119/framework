"use client";

import React from 'react';
import { createPortal } from 'react-dom';
import type { RootFrameworkProps } from './root-framework.interfaces';

type RootFrameworkState = {
  container: HTMLElement | null;
};

export class RootFramework extends React.Component<RootFrameworkProps, RootFrameworkState> {
  private createdContainer = false;

  constructor(props: RootFrameworkProps) {
    super(props);
    this.state = { container: null };
  }

  componentDidMount(): void {
    this.attachContainer(this.props.containerId || 'portal-root');
  }

  componentDidUpdate(prevProps: RootFrameworkProps): void {
    const nextContainerId = this.props.containerId || 'portal-root';
    const previousContainerId = prevProps.containerId || 'portal-root';
    if (nextContainerId !== previousContainerId) {
      this.detachContainer();
      this.attachContainer(nextContainerId);
    }
  }

  componentWillUnmount(): void {
    this.detachContainer();
  }

  render(): React.ReactNode {
    if (!this.state.container) {
      return null;
    }

    return createPortal(this.props.children, this.state.container);
  }

  private attachContainer(containerId: string): void {
    let element = document.getElementById(containerId);
    if (!element) {
      element = document.createElement('div');
      element.id = containerId;
      document.body.appendChild(element);
      this.createdContainer = true;
    }

    this.setState({ container: element });
  }

  private detachContainer(): void {
    if (this.createdContainer && this.state.container?.parentNode) {
      this.state.container.parentNode.removeChild(this.state.container);
    }

    this.createdContainer = false;
    this.setState({ container: null });
  }
}
