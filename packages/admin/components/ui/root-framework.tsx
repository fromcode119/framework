"use client";

import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface RootFrameworkProps {
  children: ReactNode;
  containerId?: string;
}

interface RootFrameworkState {
  container: HTMLElement | null;
}

export class RootFramework extends React.Component<RootFrameworkProps, RootFrameworkState> {
  state: RootFrameworkState = { container: null };
  private created = false;
  private element: HTMLElement | null = null;

  componentDidMount(): void {
    const containerId = this.props.containerId ?? 'portal-root';
    let element = document.getElementById(containerId);

    if (!element) {
      element = document.createElement('div');
      element.id = containerId;
      document.body.appendChild(element);
      this.created = true;
    }

    this.element = element;
    this.setState({ container: element });
  }

  componentWillUnmount(): void {
    if (this.created && this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  render(): React.ReactNode {
    const { container } = this.state;
    if (!container) return null;
    return createPortal(this.props.children, container);
  }
}
