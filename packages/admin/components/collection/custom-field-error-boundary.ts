import React from 'react';

export class CustomFieldErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): any {
    return { hasError: true };
  }

  componentDidCatch(error: any): void {
    const componentName = String(this.props?.componentName || 'unknown');
    console.error(`[FieldRenderer] Custom field component "${componentName}" crashed`, error);
  }

  render(): React.ReactNode {
    if (!this.state?.hasError) {
      return this.props?.children ?? null;
    }

    const componentName = String(this.props?.componentName || 'unknown');

    return React.createElement(
      'div',
      {
        className:
          'p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 text-xs font-medium tracking-wide flex items-center gap-2',
      },
      React.createElement('span', null, `Component "${componentName}" failed to render.`)
    );
  }
}
