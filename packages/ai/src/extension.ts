import type { CoreExtensionContext } from '@fromcode119/core';
import { ProviderCapabilitiesUtils } from './gateways/integration-provider';
import { AssistantRouter } from './api/routes';

export class AiExtension {
  static async onInit(context: CoreExtensionContext): Promise<void> {
    const { logger, integrations } = context.services;

    logger.info('Initializing AI extension...');

    if (integrations) {
      try {
        integrations.registerType(ProviderCapabilitiesUtils.aiIntegration);
        logger.info('Registered AI integration type');
      } catch (error) {
        logger.error('Failed to register AI integration type:', error);
        throw error;
      }
    } else {
      logger.warn('IntegrationManager not available, skipping integration registration');
    }

    context.registerCapability('ai');
    context.registerCapability('mcp');
    context.registerCapability('llm');
    context.registerCapability('forge-assistant');
    context.registerApiRoute?.('ai', (routeContext: any) => ({
      basePath: String(context.extension.manifest.apiPath || context.extension.manifest.slug || 'ai').trim(),
      router: AssistantRouter.create(routeContext),
    }));

    logger.info('AI extension initialized successfully');
  }

  static async onEnable(context: CoreExtensionContext): Promise<void> {
    context.services.logger.info('AI extension enabled');
  }

  static async onDisable(context: CoreExtensionContext): Promise<void> {
    const { logger, integrations } = context.services;
    logger.info('AI extension disabled - cleaning up...');

    try {
      const registeredCapabilities = context.getRegisteredCapabilities();
      for (const capability of registeredCapabilities) {
        context.unregisterCapability(capability);
      }
      logger.info(`Unregistered ${registeredCapabilities.length} capabilities: ${registeredCapabilities.join(', ')}`);

      if (integrations && typeof integrations.unregisterType === 'function') {
        integrations.unregisterType('ai');
        logger.info('Unregistered AI integration type');
      }

      logger.info('AI extension cleanup complete');
    } catch (error) {
      logger.error('Error during AI extension cleanup:', error);
      throw error;
    }
  }
}
