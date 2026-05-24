import type { PluginDefaultDesignDefinition } from '../../types/default-design/default-design.interfaces';

export interface PluginFrontendDefaultDesignRegistrarOptions {
  namespace: string;
  pluginSlug: string;
}

export interface PluginFrontendDefaultDesignRegistration {
  designs: PluginDefaultDesignDefinition[];
  namespace: string;
  pluginSlug: string;
}