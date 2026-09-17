export interface IMysqlBackupTarget {
  readonly host: string;
  readonly port: string;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}
