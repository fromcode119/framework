/** Whether the platform is up on a specific version — asked of the api, never assumed from a container. */
export interface IUpdaterHealth {
  reports(version: string): Promise<boolean>;
}
