import { Context as ReactorContext } from '@fromcode119/react-class-components';
import type { PluginRuntimeValue } from '@react/plugin-runtime-value';

/** Holds the React context publishing plugin runtime values to hook-free plugin class components. */
export class PluginRuntimeContext {
  static readonly context = new ReactorContext<PluginRuntimeValue | null>(null).raw;
}
