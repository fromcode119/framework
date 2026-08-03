export interface IApiPermissionCheck {
  (userId: number, permission: string): Promise<boolean> | boolean;
}
