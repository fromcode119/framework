import type { ReactNode } from 'react';
import { Reactor, prop, state, watch } from '@fromcode119/react-class-components';

/**
 * The storefront's ONE mount-point error boundary: every plugin/theme-owned component a {@link Slot}
 * attaches to the page tree is wrapped in one of these.
 *
 * Before this class NOTHING between a `Slot`-rendered block and the page root caught a lifecycle
 * throw — `Slot.renderSlotComponent`'s own `try/catch` wraps `React.createElement(Component, …)`,
 * which never actually invokes `Component` (element creation is data, not a call), so it could never
 * catch a real render/`componentDidMount` error. When ten hot-installed plugins shipped a
 * `componentDidMount` that called a method missing from that release's plugin API, React had no
 * boundary anywhere in the tree and tore down the whole root — the entire storefront blanked, not
 * just the broken widget.
 *
 * Scoped to ONE slot component at a time (not the whole page, not the whole `Slot` list): each item
 * `Slot` renders gets its own boundary instance, so a throw in one block never touches its siblings —
 * other blocks in the same slot, and every other slot on the page, keep rendering.
 */
export class PluginMountErrorBoundary extends Reactor {
  @prop declare slotName: string;
  @prop declare pluginSlug?: string;
  @prop declare componentName?: string;
  @prop declare children?: ReactNode;

  /**
   * Caller-supplied fallback shown in place of the crashed subtree. Undefined (the storefront default,
   * everywhere this boundary is used for a Slot/theme-layout/plugin-owned page body on the storefront)
   * renders nothing — no admin field configures fallback copy for a crashed plugin block on the site a
   * visitor sees, so a made-up "Something went wrong" message would itself be invented content. The
   * admin is a different audience: `Slot` usages that render an entire plugin admin page body pass one
   * of these (see `packages/admin/components/view/plugin-mount-error-fallback.tsx`) so an operator sees the same
   * "Component "X" failed to render." convention `CustomFieldErrorBoundary` already established, rather
   * than a silently blank page.
   */
  @prop declare renderFallback?: (identity: { pluginSlug?: string; componentName?: string }) => ReactNode;

  @state hasError = false;

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: unknown): void {
    console.error(
      `[Slot] Plugin component crashed and was unmounted — slot="${this.slotName}" plugin="${this.pluginSlug || 'unknown'}" component="${this.componentName || 'unknown'}"`,
      error,
      errorInfo,
    );
  }

  /**
   * The real-world failure this boundary exists for (a plugin API stand-in missing a method until the
   * real plugin runtime registers, ~700ms later) is TRANSIENT: the cause resolves on its own within the
   * same page view. Latching `hasError` for the page's whole lifetime would keep that subtree blank
   * long after the underlying race is over. `children` is a fresh element on every render of whatever
   * mounts this boundary (Slot / a theme layout host / Override), so a reference change is a reliable
   * signal that the world moved — most commonly the plugin context updating and re-rendering its
   * consumers. On that signal, retry: if the cause is gone the subtree renders again; if it isn't,
   * `getDerivedStateFromError` re-catches immediately.
   */
  @watch('children')
  private resetOnChildrenChange(next: ReactNode, previous: ReactNode): void {
    if (this.hasError && next !== previous) this.hasError = false;
  }

  render(): ReactNode {
    if (this.hasError) {
      return this.renderFallback?.({ pluginSlug: this.pluginSlug, componentName: this.componentName }) ?? null;
    }
    return this.children ?? null;
  }
}
