/** Where the deployment records which version it runs, so a later `docker compose up` agrees with the update. */
export interface IVersionFile {
  read(): string;
  write(version: string): void;
}
