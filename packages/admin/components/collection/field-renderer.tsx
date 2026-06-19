import React from 'react';
import { ContextHooks } from '@fromcode119/react';
import { FieldRendererView } from './field-renderer-view';
import type { FieldRendererProps } from './field-renderer.interfaces';

/**
 * Thin functional shim — reads `ContextHooks.usePlugins()` and hands the registry to the hook-free
 * {@link FieldRendererView} class, which holds the locale-menu state, ref, and effects.
 */
export function FieldRenderer(props: FieldRendererProps): React.ReactElement {
  const plugins = ContextHooks.usePlugins();
  return <FieldRendererView {...props} plugins={plugins} />;
}
