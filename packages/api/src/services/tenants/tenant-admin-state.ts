import type { IDatabaseManager } from '@fromcode119/database';
import { SystemBackupRepository } from '@api/repositories/system-backup-repository';
import { TenantLookup } from '@api/services/tenants/tenant-lookup';
import { TenantMembersService } from '@api/services/tenants/tenant-members-service';
import { TenantPagesService } from '@api/services/tenants/tenant-pages-service';
import type { AppearanceManager, BackupCatalogService, PluginManager, TenantMembershipService, TenantRegistryService, ThemeManager } from '@fromcode119/core';

/**
 * Everything `TenantAdminService` holds, declared once for the halves that work on it.
 *
 * `declare` only — these emit nothing, and the service assigns every one of them in its constructor.
 * A `declare`d field carrying an initialiser would simply not run.
 */
export abstract class TenantAdminState {
  /** Declared here because the archive half calls what the service implements. */
  protected abstract presets(): any[];

  protected declare db: IDatabaseManager;
  protected declare registry: TenantRegistryService;
  protected declare memberships: TenantMembershipService;
  protected declare catalog: BackupCatalogService;
  protected declare audit: SystemBackupRepository;
  protected declare appearances: AppearanceManager;
  protected declare gateway: any;
  protected declare lookup: TenantLookup;
  protected declare membersService: TenantMembersService;
  protected declare pagesService: TenantPagesService;
  protected declare manager: PluginManager;
  protected declare themeManager: ThemeManager;
  protected declare uploadsDir: string;
}
