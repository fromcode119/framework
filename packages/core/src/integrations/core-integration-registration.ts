import { IntegrationRegistry } from '@core/integrations/integration-registry';
import { EmailIntegrationDefinition } from '@core/integrations/providers/email-integration-definition';
import { StorageIntegrationDefinition } from '@core/integrations/providers/storage-provider';
import { CacheIntegrationDefinition } from '@core/integrations/providers/cache-provider';
import { QueueIntegrationDefinition } from '@core/integrations/providers/queue-provider';
import { McpIntegrationDefinition } from '@core/integrations/providers/mcp-integration-definition';
import { SsoIntegrationDefinition } from '@core/integrations/providers/sso-provider';

/**
 * The integration types the framework itself ships, and the ONE place that list is written.
 *
 * It sat in `IntegrationManager`'s constructor path, which meant six imports of provider definitions
 * in a class that otherwise resolves and caches instances and never looks at a definition again.
 * Moving it here is what took that file under the 300-line limit, and it puts "what does this
 * framework integrate with" in a file whose name answers that question.
 *
 * AI is deliberately absent: it is registered by the AI core extension (`packages/ai/src/extension.ts`)
 * because it is an extension, and listing it here as well would register it twice.
 */
export class CoreIntegrationRegistration {
  static applyTo(registry: IntegrationRegistry): void {
    registry.registerType(EmailIntegrationDefinition.definition);
    registry.registerType(StorageIntegrationDefinition.definition);
    registry.registerType(CacheIntegrationDefinition.definition);
    registry.registerType(QueueIntegrationDefinition.definition);
    registry.registerType(SsoIntegrationDefinition.definition);
    registry.registerType(McpIntegrationDefinition.definition);
  }
}
