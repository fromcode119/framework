/** One group of fields on a record's edit screen, in the order the collection declares them. */
export interface ICollectionEditSection {
  key: string;
  title?: string;
  fields: Array<{ name: string; label?: unknown; type?: string; admin?: Record<string, unknown> }>;
}
