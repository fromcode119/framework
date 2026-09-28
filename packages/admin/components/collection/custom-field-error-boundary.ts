import React from 'react';

import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/react-class-components';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
      React.createElement('span', null, AdminI18n.t('ui.field.componentFailed', { name }))
    );
  }
}
