import type { ReactNode } from 'react';

export interface ISlotProps {
  name: string;
  props?: Record<string, any>;
  fallback?: ReactNode;
  /**
   * Fallback rendered in place of a slot component that crashed on mount/render, instead of the
   * default "render nothing". See `PluginMountErrorBoundary.renderFallback` — the storefront leaves
   * this unset; the admin passes `errorFallback` on the Slots that render an entire plugin admin page
   * body, so a crash is visible to the operator rather than a blank page.
   */
  errorFallback?: (identity: { pluginSlug?: string; componentName?: string }) => ReactNode;
}
