import type { z } from 'zod';

/** What an event promises its listeners: a name, an optional version, and the shape of its payload. */
export interface IEventContract {
  event: string;
  version?: number;
  /** A zod schema the payload must satisfy. Omitted means "declared, but shape not constrained". */
  schema?: z.ZodTypeAny;
  /** The plugin (slug) that declared it, for the console and for blame on a drift. */
  owner?: string;
}
