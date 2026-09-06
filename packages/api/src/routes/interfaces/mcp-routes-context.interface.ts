import type { McpToolRegistry } from '@fromcode119/mcp';
import type { TenantRecord } from '@fromcode119/core';
import type { IMcpAuditRecorder } from '@api/controllers/mcp/interfaces/mcp-audit-recorder.interface';
import type { IMcpPermissionChecker } from '@api/controllers/mcp/interfaces/mcp-permission-checker.interface';

export interface IMcpRoutesContext {
  registry: McpToolRegistry;
  permissions: IMcpPermissionChecker;
  audit: IMcpAuditRecorder;
  db: any;
  auth: {
    requireApiToken(): (req: any, res: any, next: any) => void;
    guard(roles?: string[]): (req: any, res: any, next: any) => void;
  };
  /** The api's live `_system_meta` mirror — the hosted-transport toggle is read from it per request. */
  settingsCache: Map<string, string>;
  /** The platform's sites, for `/mcp/sites` and for binding a token to the site that issued it. */
  tenants: { list(): Promise<TenantRecord[]>; get(id: string): Promise<TenantRecord | null> };
  /** Who may issue an all-sites token and see every site's tokens. */
  memberships: { isPlatformAdminAccount(userId: string): Promise<boolean> };
}
