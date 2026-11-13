/**
 * Values a new record starts with when the page that opened it already knows them.
 *
 * "Refund this order" or "Return this shipment" opens the ordinary new-record form; the link carries
 * what is already known as `with.<field>=<value>`, so the operator does not retype it and cannot pick
 * the wrong parent. Only fields the collection declares are taken, each as the form would hold it, and
 * every one is on screen in the form before anything is saved — nothing is set out of sight.
 */
export class CollectionEditStartingValues {
  static readonly PREFIX = 'with.';

  static read(collection: any, searchParams: URLSearchParams | undefined): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!searchParams) return out;
    const fields = new Map<string, any>((collection?.fields || []).map((field: any) => [String(field?.name || ''), field]));
    searchParams.forEach((raw, key) => {
      if (!key.startsWith(CollectionEditStartingValues.PREFIX)) return;
      const field = fields.get(key.slice(CollectionEditStartingValues.PREFIX.length));
      const value = String(raw ?? '').trim();
      if (!field || !value) return;
      out[field.name] = CollectionEditStartingValues.cast(field, value);
    });
    return out;
  }

  /** A number field or a relationship id holds a number when the text is one; everything else stays text. */
  private static cast(field: any, value: string): unknown {
    const numeric = field?.type === 'number' || field?.type === 'relationship';
    return numeric && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
  }
}
