import type { IRecordsHubItem } from '@react/interfaces/records-hub-item.interface';

export interface IRecordsHubGroup {
  group: string;
  items: IRecordsHubItem[];
}
