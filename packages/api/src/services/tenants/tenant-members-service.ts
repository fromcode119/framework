import fs from 'fs';
import path from 'path';
import type { IDatabaseManager } from '@fromcode119/database';
import {
  AuditOutcome, BackupCatalogService, BackupService, CoercionUtils, PluginManager, PluginState, PluginTenantStateService, SystemConstants,
  TenantAdoptionService, TenantArchiveLayout, TenantArchiveManifest, TenantArchiveReader, TenantArchiveSource, TenantArchiveWriter, TenantEraser, TenantIdentity,
  TenantImportExecutor, TenantImportPlan, TenantImportPlanner, TenantImportResult, TenantMembershipService, TenantMode, TenantRecord,
  TenantRegistryService, TenantResolverService, TenantTableCatalog, TenantTableDescriptor, TenantThemeAccess, TenantThemeStateService, ThemeManager,
  PluginTenantAccess, RequestContextUtils, AppearanceManager, Logger, TenantKindPreset, TenantKindPresets, StringUtils, StorefrontPagesCollection } from '@fromcode119/core';
import { TenantSummary } from '@api/services/tenants/tenant-summary';

/**
 * Everything the Sites admin can do to a tenant, in one place, on the OWNER connection.
 *
 * The owner (`schemaDb`) is deliberate: exports and deletes read and write across a whole tenant
 * under `withTenant`, imports insert rows carrying explicit ids and advance sequences, adoption
 * stamps every table. The request connection (`fromcode_app`) is the wrong actor for all of that —
 * and every one of these is already behind `PlatformAdminGuard`.
 *
 * Every operation that changes what exists is recorded in the backup audit table, with the actor.
 */
import { TenantLookup } from '@api/services/tenants/tenant-lookup';

/**
 * Who belongs to a tenant and with which role — the paged member list plus add/remove.
 *
 * Split out of TenantAdminService (481 lines) 2026-09-09; that service composes this one and delegates,
 * so the controller's surface is unchanged.
 */
export class TenantMembersService {
  constructor(
    private readonly db: IDatabaseManager,
    private readonly memberships: TenantMembershipService,
    private readonly lookup: TenantLookup,
  ) {}

  /** Members returned per page, and the ceiling a caller may ask for. */
  /** The role that lets an account load the admin; membership decides which sites it then sees. */
  private static readonly ADMIN_ROLE = 'admin';

  private static readonly MEMBER_PAGE = 25;

  private static readonly MEMBER_PAGE_MAX = 200;


  /**
   * One page of a site's members, newest membership first, optionally narrowed by email.
   *
   * Paged because a site's membership is unbounded: rendering all of it was the reason loading the
   * Sites page could issue a query per member. `limit` is clamped so a caller cannot ask for the whole
   * table by passing a large number.
   */
  async members(tenantId: string, options: { q?: string; limit?: number; offset?: number } = {}): Promise<{
    members: Array<{ userId: string; email: string; roles: string[]; state: string }>;
    total: number;
  }> {
    const tenant = await this.lookup.requireTenant(tenantId);
    const limit = Math.min(Math.max(CoercionUtils.toNumber(options.limit, TenantMembersService.MEMBER_PAGE), 1), TenantMembersService.MEMBER_PAGE_MAX);
    const offset = Math.max(CoercionUtils.toNumber(options.offset, 0), 0);
    const search = CoercionUtils.toKey(options.q);

    // One join rather than a lookup per row — the N+1 this replaces is the whole point.
    const rows = await this.db.queryRaw(
      `SELECT m.user_id, m.roles, m.state, u.email
         FROM ${SystemConstants.TABLE.TENANT_MEMBERSHIPS} m
         LEFT JOIN ${SystemConstants.TABLE.USERS} u ON u.id::text = m.user_id::text
        WHERE m.tenant_id = $1 ${search ? 'AND LOWER(u.email) LIKE $4' : ''}
        ORDER BY m.user_id DESC
        LIMIT $2 OFFSET $3`,
      search ? [tenant.id, limit, offset, `%${search}%`] : [tenant.id, limit, offset],
    );
    const counted = await this.db.queryRaw(
      `SELECT COUNT(*)::int AS total
         FROM ${SystemConstants.TABLE.TENANT_MEMBERSHIPS} m
         ${search ? `LEFT JOIN ${SystemConstants.TABLE.USERS} u ON u.id::text = m.user_id::text` : ''}
        WHERE m.tenant_id = $1 ${search ? 'AND LOWER(u.email) LIKE $2' : ''}`,
      search ? [tenant.id, `%${search}%`] : [tenant.id],
    );

    return {
      members: (rows ?? []).map((row: any) => ({
        userId: CoercionUtils.toString(row.user_id),
        email: CoercionUtils.toString(row.email),
        roles: TenantSummary.roles(row.roles),
        state: CoercionUtils.toString(row.state),
      })),
      total: CoercionUtils.toNumber(counted?.[0]?.total),
    };
  }


  /**
   * Grants an existing account access to a site.
   *
   * The roles are the account's roles ON THIS SITE — `AuthManager.useTenantRoles` resolves them per
   * request — so the same account can be a customer on one site and an administrator on another. The
   * account's global roles are not touched.
   */
  async addMember(tenantId: string, email: string, roles: string[]): Promise<void> {
    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { email: CoercionUtils.toKey(email) });
    if (!user) throw new Error(`No account with email "${email}" exists on this platform. Create the account first.`);
    const userId = CoercionUtils.toString(user.id);
    await this.memberships.grant(userId, tenantId, roles);
  }



  async removeMember(tenantId: string, userId: string): Promise<void> {
    await this.memberships.revoke(userId, tenantId);
  }
}
