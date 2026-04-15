"use client";

import React from 'react';
import { PluginContextRegistry } from '../plugin-context';
import { PluginsProviderInternal } from './plugins-provider-internal';
import type { PluginsProviderProps } from './plugins-provider.types';

export class PluginsProvider extends React.Component<PluginsProviderProps> {
  static readonly PluginContext = PluginContextRegistry.Context;

  render(): React.ReactNode {
    return <PluginsProviderInternal {...this.props} providerClass={PluginsProvider} />;
  }
}
