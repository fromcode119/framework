import type { IRecordsHubGroup } from '@react/interfaces/records-hub-group.interface';

export interface IRecordsHubState {
  loading: boolean;
  error: string;
  groups: IRecordsHubGroup[];
  total: number;
  activeGroup: string;
  errors: Array<{ provider: string; message: string }>;
}
