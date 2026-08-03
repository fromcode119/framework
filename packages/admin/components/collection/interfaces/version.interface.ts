export interface IVersion {
  id: number;
  version: number;
  date: Date;
  user: string;
  action: string;
  changes: any;
}
