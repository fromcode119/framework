/**
 * The keys `CoreServices` and `ServerCoreServices` agree on.
 *
 * They are looked up by string at runtime — a registry is the point — so a literal typo would surface as
 * a throw from a getter nobody exercised until production. Naming them once removes that.
 */
export class ServerServiceKey {
  static readonly COLLECTION_WRITE_COMPATIBILITY = 'collectionWriteCompatibility';

  static readonly DEFAULT_PAGE_CONTRACTS = 'defaultPageContracts';

  static readonly DEFAULT_PAGE_CONTRACT_RESOLUTION = 'defaultPageContractResolution';

  static readonly DEFAULT_PAGE_BACKFILL = 'defaultPageBackfill';

  static readonly DEFAULT_PAGE_DIAGNOSTIC = 'defaultPageDiagnostic';

  static readonly DEFAULT_PAGE_MATERIALIZATION = 'defaultPageMaterialization';

  static readonly SEED_PAGE = 'seedPage';

  static readonly CONTENT_RESOLUTION_GATES = 'contentResolutionGates';

  static readonly REDIRECT_RESOLVERS = 'redirectResolvers';

  static readonly ENTITY_RECORDS = 'entityRecords';

  static readonly ENTITY_RECORDS_RESOLUTION = 'entityRecordsResolution';
}
