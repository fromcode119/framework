import React from 'react';

import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/reactor';

export class CustomFieldErrorBoundary extends Reactor {
  @prop declare componentName?: string;
  @prop declare children?: ReactNode;

  @state hasError = false;

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    const name = String(this.componentName || 'unknown');
    console.error(`[FieldRenderer] Custom field component "${name}" crashed`, error);
  }

  render(): ReactNode {
    if (!this.hasError) {
      return this.children ?? null;
    }

    const name = String(this.componentName || 'unknown');

    return React.createElement(
      'div',
      {
        className:
          'p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 text-xs font-medium tracking-wide flex items-center gap-2',
      },
      React.createElement('span', null, `Component "${name}" failed to render.`)
    );
  }
}
