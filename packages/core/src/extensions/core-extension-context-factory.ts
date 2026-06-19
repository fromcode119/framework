import { Logger } from '../logging';
import { IDatabaseManager } from '@fromcode119/database';
import { CapabilityRegistry } from '../capabilities';
import { LoadedCoreExtension, CoreExtensionContext } from './types';

/**
 * CoreExtensionContextFactory
 *
 * Builds the per-extension context object handed to a core extension's lifecycle
 * hooks, wiring its capability/route/admin-slot registration callbacks to the
 * manager-owned collections. Extracted from CoreExtensionManager to keep that
 * class under the size limit; the manager passes its own collections in by
 * reference so registrations land in the same maps as before.
 */
export class CoreExtensionContextFactory {
  constructor(
    private db: IDatabaseManager,
    private logger: Logger,
    private capabilities: Set<string>,
    private registeredApiRoutes: Map<string, any>,
    private registeredAdminSlots: Map<string, Array<{ slot: string; component: any; priority: number; extensionSlug: string }>>,
    private getServices: () => { integrations?: any; hooks?: any; plugins?: any },
  ) {}

  public create(extension: LoadedCoreExtension): CoreExtensionContext {
    const logger = this.logger.child(extension.manifest.slug);
    const extensionCapabilities: string[] = [];
    const services = this.getServices();

    return {
      extension,
      services: {
        logger,
        db: this.db,
        integrations: services.integrations,
        hooks: services.hooks,
        plugins: services.plugins,
      },
      registerCapability: (capability: string) => {
        this.capabilities.add(capability);
        extensionCapabilities.push(capability);
        // Also register in global capability registry
        CapabilityRegistry.getInstance().register(capability, {
          provider: extension.manifest.slug,
          version: extension.manifest.version,
          description: extension.manifest.description,
        });
        logger.info(`Registered capability: ${capability}`);
      },
      unregisterCapability: (capability: string) => {
        this.capabilities.delete(capability);
        const index = extensionCapabilities.indexOf(capability);
        if (index > -1) {
          extensionCapabilities.splice(index, 1);
        }
        // Also unregister from global capability registry
        CapabilityRegistry.getInstance().unregister(capability);
        logger.info(`Unregistered capability: ${capability}`);
      },
      getRegisteredCapabilities: () => [...extensionCapabilities],
      registerApiRoute: (routeKey: string, factory: any) => {
        const normalizedKey = String(routeKey || '').trim() || extension.manifest.slug;
        this.registeredApiRoutes.set(normalizedKey, factory);
        logger.info(`Registered API route '${normalizedKey}' for extension: ${extension.manifest.slug}`);
      },
      registerAdminSlot: (slot: string, component: any, priority: number = 10) => {
        if (!this.registeredAdminSlots.has(slot)) {
          this.registeredAdminSlots.set(slot, []);
        }
        this.registeredAdminSlots.get(slot)!.push({
          slot,
          component,
          priority,
          extensionSlug: extension.manifest.slug,
        });
        logger.info(`Registered admin slot '${slot}' with priority ${priority} for extension: ${extension.manifest.slug}`);
      },
    };
  }
}
