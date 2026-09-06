import { ThemeMode } from '@fromcode119/core/client';
import { prop } from '@fromcode119/reactor';
import { ShellBoundary } from '@react/view/shell-boundary';
import { ShellImplementation } from '@react/shell-implementation';
import type { IRecordsHubItem } from '@react/interfaces/records-hub-item.interface';
import type { IRecordsHubResult } from '@react/interfaces/records-hub-result.interface';

/**
 * Grouped, newest-first timeline of every record a person owns across plugins, rendered inside its
 * Suspense boundary. The surface itself is `RecordsHubImplementation` — static on the server, code-split
 * in the browser; see `ShellBoundary` for why the boundary lives on this class. Every prop reaches the
 * implementation unchanged.
 */
export class RecordsHub extends ShellBoundary {
  /** Filled by `RecordsHubImplementation` on evaluation; the browser bridge swaps in its lazy twin. */
  static readonly implementation = new ShellImplementation();

  /** Fetch the aggregated records (host owns auth). */
  @prop declare load: () => Promise<IRecordsHubResult>;
  /** Host handler for opening/downloading an item (href nav or authed download). */
  @prop declare onOpenItem?: (item: IRecordsHubItem) => void;
  @prop declare theme?: ThemeMode | string;
  @prop declare title?: string;
  @prop declare emptyHint?: string;
  /** Re-run the fetch when this value changes (e.g. the person/route id). */
  @prop declare reloadKey?: string | number;

  protected get shellImplementation(): ShellImplementation {
    return RecordsHub.implementation;
  }
}
