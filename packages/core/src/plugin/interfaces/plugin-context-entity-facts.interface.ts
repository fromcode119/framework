/**
 * The `context.entityFacts` surface of {@link PluginContext}: facts one plugin holds about another
 * plugin's records (a product's rating), exchanged by entity kind so neither names the other.
 */
export interface IPluginContextEntityFacts {
  /** Answer `fact` about records of `entity` — values keyed by record id. */
  registerProvider(input: {
    entity: string;
    fact: string;
    resolve: (ids: string[]) => Promise<Record<string, unknown>>;
  }): any;
  /** Ask for `fact` about these records of `entity`; ids nobody knows about are left out. */
  resolve(entity: string, fact: string, ids: Array<string | number>): Promise<Record<string, unknown>>;
  /** Whether any active plugin answers `fact` about `entity`. */
  has(entity: string, fact: string): Promise<boolean>;
}
