import type { IRecordsHubItem } from '@react/interfaces/records-hub-item.interface';
import type { IRecordsHubGroup } from '@react/interfaces/records-hub-group.interface';

export interface IRecordsHubResult {
  items?: IRecordsHubItem[];
  groups?: IRecordsHubGroup[];
  providers?: string[];
  /** What can be started from the subject: a label and the admin path that opens it. */
  actions?: Array<{ id: string; label: string; href: string; icon?: string; part?: string }>;
  errors?: Array<{ provider: string; message: string }>;
}
