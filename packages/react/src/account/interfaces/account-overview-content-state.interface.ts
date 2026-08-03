import type { IAccountOverviewStat } from '@react/account/interfaces/account-overview-stat.interface';

export interface IAccountOverviewContentState {
  loading: boolean;
  person: Record<string, any> | null;
  stats: IAccountOverviewStat[];
}
