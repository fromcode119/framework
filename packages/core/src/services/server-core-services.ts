import { CollectionWriteCompatibilityService } from '@core/services/collection-write-compatibility-service';
import { ContentResolutionGateRegistryService } from '@core/services/content-resolution-gate-registry-service';
import { CoreServices } from '@core/services/core-services';
import { EntityRecordsResolutionService } from '@core/services/entity-records/entity-records-resolution-service';
import { PluginDefaultPageBackfillService } from '@core/services/default-page-contract/plugin-default-page-backfill-service';
import { PluginDefaultPageContractRegistryService } from '@core/services/default-page-contract/plugin-default-page-contract-registry-service';
import { PluginDefaultPageContractResolutionService } from '@core/services/default-page-contract/plugin-default-page-contract-resolution-service';
import { PluginDefaultPageDiagnosticService } from '@core/services/default-page-contract/plugin-default-page-diagnostic-service';
import { PluginDefaultPageMaterializationService } from '@core/services/default-page-contract/plugin-default-page-materialization-service';
import { PluginEntityRecordsRegistryService } from '@core/services/entity-records/plugin-entity-records-registry-service';
import { RedirectResolverRegistryService } from '@core/services/redirect-resolver-registry-service';
import { SeedPageService } from '@core/services/seed-page-service';
import { ServerServiceKey } from '@core/services/server-service-key';
import { ServerServiceRegistry } from '@core/services/server-service-registry';

/**
 * Wires the SERVER-only core services into the registry `CoreServices` reads.
 *
 * This module is the only place those services are imported as VALUES, and it is reachable only from
 * `@fromcode119/core` — the server barrel — never from `@fromcode119/core/client`. That is what keeps
 * ~47 KB of page-contract, seeding and collection-write code out of every browser bundle while
 * `CoreServices.getInstance().defaultPageContracts.register(...)` keeps working unchanged for plugins.
 *
 * Registration is idempotent and cheap: factories only, nothing is constructed until a caller asks.
 */
export class ServerCoreServices {
  private static registered = false;

  static register(): void {
    if (ServerCoreServices.registered) return;
    ServerCoreServices.registered = true;

    const core = () => CoreServices.getInstance();

    ServerServiceRegistry.register(
      ServerServiceKey.COLLECTION_WRITE_COMPATIBILITY,
      () => new CollectionWriteCompatibilityService(core().collection),
    );
    ServerServiceRegistry.register(ServerServiceKey.SEED_PAGE, () => new SeedPageService());
    ServerServiceRegistry.register(
      ServerServiceKey.DEFAULT_PAGE_CONTRACTS,
      () => new PluginDefaultPageContractRegistryService(),
    );
    ServerServiceRegistry.register(
      ServerServiceKey.DEFAULT_PAGE_CONTRACT_RESOLUTION,
      () => new PluginDefaultPageContractResolutionService(core().defaultPageContracts),
    );
    ServerServiceRegistry.register(
      ServerServiceKey.DEFAULT_PAGE_BACKFILL,
      () => new PluginDefaultPageBackfillService(core().seedPage),
    );
    ServerServiceRegistry.register(
      ServerServiceKey.DEFAULT_PAGE_MATERIALIZATION,
      () => new PluginDefaultPageMaterializationService(core().seedPage),
    );
    ServerServiceRegistry.register(
      ServerServiceKey.DEFAULT_PAGE_DIAGNOSTIC,
      () => new PluginDefaultPageDiagnosticService(
        core().defaultPageContractResolution,
        core().defaultPageMaterialization,
        core().defaultPageBackfill,
      ),
    );
    ServerServiceRegistry.register(
      ServerServiceKey.CONTENT_RESOLUTION_GATES,
      () => new ContentResolutionGateRegistryService(),
    );
    ServerServiceRegistry.register(
      ServerServiceKey.REDIRECT_RESOLVERS,
      () => new RedirectResolverRegistryService(),
    );
    ServerServiceRegistry.register(
      ServerServiceKey.ENTITY_RECORDS,
      () => new PluginEntityRecordsRegistryService(),
    );
    ServerServiceRegistry.register(
      ServerServiceKey.ENTITY_RECORDS_RESOLUTION,
      () => new EntityRecordsResolutionService(core().entityRecords),
    );
  }
}
