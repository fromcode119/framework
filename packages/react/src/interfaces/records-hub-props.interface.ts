import { ThemeMode } from '@fromcode119/core/client';
import type { IRecordsHubItem } from '@react/interfaces/records-hub-item.interface';
import type { IRecordsHubResult } from '@react/interfaces/records-hub-result.interface';

export interface IRecordsHubProps {
  /** Fetch the aggregated records (host owns auth). */
  load: () => Promise<IRecordsHubResult>;
  /** Host handler for opening/downloading an item (href nav or authed download). */
  onOpenItem?: (item: IRecordsHubItem) => void;
  theme?: ThemeMode | string;
  title?: string;
  emptyHint?: string;
  /** Re-run load() when this value changes (e.g. the person/route id). */
  reloadKey?: string | number;
}
