import type { ChangeEvent, ContextType, ReactNode } from 'react';
import { Reactor, prop, bound } from '@fromcode119/reactor';
import { PluginContextRegistry } from '@fromcode119/react';

/**
 * Theme style-variant <select>. Hook-free class (reactor): props via `@prop`, the change handler a
 * `@bound` method, and `themeStyleVariants` read from the plugin context via `static contextType`
 * instead of the usePlugins hook. Extends `Reactor` (not `PureReactor`) so context-value changes are
 * never blocked by a shallow prop compare.
 */
export class ThemeStyleVariantSelect extends Reactor {
  @prop declare value: string;
  @prop declare onChange: (v: string) => void;
  @prop declare includeAuto?: boolean;

  static contextType = PluginContextRegistry.Context;
  declare context: ContextType<typeof PluginContextRegistry.Context>;

  private get withAuto(): boolean {
    return this.includeAuto ?? true;
  }

  private get options(): Array<{ value: string; label: string }> {
    const themeStyleVariants = ((this.context as any)?.themeStyleVariants as Record<string, any>) ?? {};
    return [
      ...(this.withAuto ? [{ value: 'auto', label: 'Auto' }] : []),
      ...Object.entries(themeStyleVariants).map(([key, v]) => ({ value: key, label: (v as any).label ?? key })),
    ];
  }

  @bound
  protected onSelectChange(event: ChangeEvent<HTMLSelectElement>): void {
    this.onChange(event.target.value);
  }

  render(): ReactNode {
    return (
      <select value={this.value} onChange={this.onSelectChange}>
        {this.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }
}
