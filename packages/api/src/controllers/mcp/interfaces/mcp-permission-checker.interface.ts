export interface IMcpPermissionChecker {
  hasPermission(userId: number, permission: string): Promise<boolean>;
}
