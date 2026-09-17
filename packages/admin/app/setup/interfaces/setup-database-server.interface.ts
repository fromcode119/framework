/** A server the operator runs, as the form collects it. */
export interface ISetupDatabaseServer {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ownerUser: string;
  ownerPassword: string;
}
