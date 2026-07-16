import type { CoreExtensionContext } from '@fromcode119/core';
import { AuditManager } from '@fromcode119/core';
import { ProviderCapabilitiesUtils } from './gateways/integration-provider';
import { AiActComplianceWrapper } from './gateways/ai-act-compliance-wrapper';
import { AssistantRouter } from './api/routes';

export class AiExtension {
  static async onInit(context: CoreExtensionContext): Promise<void> {
    const { logger, integrations, db } = context.services;

    logger.info('Initializing AI extension...');

    // EU AI Act Art. 12 record-keeping: persist every model invocation to the framework audit store so an
    // admin can review income-adjacent AI interactions (Art. 50 transparency, live 2 Aug 2026). The wrapper
    // stamps disclosures regardless; this makes the record retained + queryable instead of console-only.
    if (db) {
      const audit = new AuditManager(db);
      AiActComplianceWrapper.useSink((entry) => {
        void audit.logAction('system', 'ai.invoke', entry.purpose || 'unspecified', entry.ok ? 'allowed' : 'violation', {
          provider: entry.provider, model: entry.model, riskTier: entry.riskTier, ms: entry.ms,
          promptChars: entry.promptChars, responseChars: entry.responseChars, ok: entry.ok, error: entry.error,
        });
      });
      logger.info('Wired EU AI Act audit sink → _system_audit_logs');
    }

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
