import type { IRecordsHubItem } from '@react/interfaces/records-hub-item.interface';
import type { IRecordsHubGroup } from '@react/interfaces/records-hub-group.interface';

export interface IRecordsHubResult {
  items?: IRecordsHubItem[];
  groups?: IRecordsHubGroup[];
  providers?: string[];
  errors?: Array<{ provider: string; message: string }>;
}
