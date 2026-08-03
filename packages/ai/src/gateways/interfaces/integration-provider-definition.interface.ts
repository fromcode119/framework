import type { IIntegrationConfigField } from '@ai/gateways/interfaces/integration-config-field.interface';

/**
 * One provider behind an integration type — its identity, the config it needs, and how to instantiate it.
 *
 * An `interface`, not a `type` literal: it has a call member (`create`), which is a behavioural contract,
 * and an interface carries the generic parameter just as well.
 */
export interface IIntegrationProviderDefinition<TInstance = any> {
  key: string;
  label: string;
  description?: string;
  fields?: IIntegrationConfigField[];
  create(config: Record<string, any>, context?: { projectRoot?: string; logger?: any }): TInstance | Promise<TInstance>;
  normalizeConfig?(config: Record<string, any>): Record<string, any>;
}
