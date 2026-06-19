import type { FieldRendererProps } from './field-renderer.interfaces';

export interface FieldRendererViewProps extends FieldRendererProps {
  /** Plugin registry from `ContextHooks.usePlugins()`, supplied by the thin functional shim. */
  plugins: any;
}

export interface FieldRendererViewState {
  activeLocale: string;
  isLocaleMenuOpen: boolean;
}
