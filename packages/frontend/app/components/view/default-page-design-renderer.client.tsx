import { LayoutResolutionStatus } from '@fromcode119/core/client';
import type { ComponentType, ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import { CoreServices } from '@fromcode119/core/client';
import { PluginContextRegistry } from '@fromcode119/react/plugin-context';
import { DefaultPageDesignRendererUtils } from '@/app/default-page-design-renderer-utils';

export class DefaultPageDesignRenderer extends Reactor {
  static contextType = PluginContextRegistry.Context;

  @prop declare content?: unknown;
  @prop declare entry?: unknown;

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
      typeof Component === 'string' ||
      Boolean((Component as any)?.$$typeof);
    if (!isRenderableComponent) {
      console.warn(`[DefaultPageDesignRenderer] Invalid component for target "${targetKey}". Owner: ${resolved.winnerOwner || 'unknown'}`);
      return null;
    }

    return <Component content={this.content} entry={this.entry} />;
  }
}
