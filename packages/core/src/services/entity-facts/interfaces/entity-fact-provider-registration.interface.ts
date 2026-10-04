/**
 * One plugin answering one FACT about records of one ENTITY kind — "the rating of these products".
 *
 * The entity kind is the shared vocabulary relationships already use (`relationToEntity: 'product'`),
 * never a plugin's name: the plugin holding reviews answers about products without knowing who owns
 * them, and the owner asks without knowing who answers.
 */
export interface IEntityFactProviderRegistration {
  namespace: string;
  pluginSlug: string;
  /** The entity kind (`product`). */
  entity: string;
  /** The fact (`rating`). */
  fact: string;
  /** Values keyed by record id, for the ids asked about; an id it knows nothing about is left out. */
  resolve: (ids: string[]) => Promise<Record<string, unknown>>;
  /**
   * Whether the provider may answer right now — its plugin active and enabled for the site asking.
   * Checked on every question, so a plugin disabled since it registered stops answering at once.
   */
  answers?: () => boolean;
}
