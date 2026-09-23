import { LayoutResolutionStatus } from '@fromcode119/core/client';
import type { ComponentType, ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/react-class-components';
import { CoreServices } from '@fromcode119/core/client';
import { PluginContextRegistry } from '@fromcode119/react/plugin-context';
import { PluginMountErrorBoundary } from '@fromcode119/react';
import { DefaultPageDesignRendererUtils } from '@/app/default-page-design-renderer-utils';

export class DefaultPageDesignRenderer extends Reactor {
  static contextType = PluginContextRegistry.Context;

  @prop declare content?: unknown;
  @prop declare entry?: unknown;

  private unsubscribe: (() => void) | null = null;

  /**
   * The design's component is registered by its plugin's storefront bundle, which for an idle plugin
   * evaluates AFTER this first rendered. Re-render when layouts change, or the page keeps the empty
   * box it painted before the design existed.
   */
  componentDidMount(): void {
    this.unsubscribe = CoreServices.getInstance().defaultDesignRuntimeBridge.subscribe(() => this.forceUpdate());
  }

  componentWillUnmount(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  render(): ReactNode {
    const activeTheme = (this.context as { activeTheme?: { slug?: string } } | null)?.activeTheme;
    const targetKey = DefaultPageDesignRendererUtils.resolvePageTargetKey(this.entry);

    if (!targetKey) {
      return null;
    }

    const resolved = CoreServices.getInstance().defaultDesignRuntimeBridge.resolvePageTarget(
      targetKey,
      String(activeTheme?.slug || '').trim() || undefined,
    );

    if (resolved.status !== LayoutResolutionStatus.RESOLVED || !resolved.winner) {
      return null;
    }

    const Component = resolved.winner as ComponentType<{ content?: unknown; entry?: unknown }>;
    const isRenderableComponent =
      typeof Component === 'function' ||
      Boolean((Component as any)?.$$typeof);
    if (!isRenderableComponent) {
      console.warn(`[DefaultPageDesignRenderer] Invalid component for target "${targetKey}". Owner: ${resolved.winnerOwner || 'unknown'}`);
      return null;
    }

    return (
      <PluginMountErrorBoundary slotName="default-page-design" componentName={targetKey}>
        <Component content={this.content} entry={this.entry} />
      </PluginMountErrorBoundary>
    );
  }
}
