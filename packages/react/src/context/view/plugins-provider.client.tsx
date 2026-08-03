import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import { ClientType } from '@fromcode119/core/client';
import { PluginContextRegistry } from '@react/plugin-context';
import { PluginsProviderInternal } from '@react/context/view/plugins-provider-internal.client';

/**
 * Public entry point for the plugin runtime context.
 *
 * A thin shell: it exposes the context object as a static and forwards its props to
 * {@link PluginsProviderInternal}, which does the work. The props are declared rather than spread from
 * `this.props`, because a `Reactor` types `props` as an opaque record — the internal component's
 * contract would not be satisfied by a blind spread.
 */
export class PluginsProvider extends Reactor {
  static readonly PluginContext = PluginContextRegistry.Context;

  @prop declare children: ReactNode;
  @prop declare apiUrl: string;
  @prop declare clientType: ClientType;
  @prop declare runtimeModules?: Record<string, unknown>;

  render(): ReactNode {
    return (
      <PluginsProviderInternal
        apiUrl={this.apiUrl}
        clientType={this.clientType}
        runtimeModules={this.runtimeModules}
        providerClass={PluginsProvider}
      >
        {this.children}
      </PluginsProviderInternal>
    );
  }
}
