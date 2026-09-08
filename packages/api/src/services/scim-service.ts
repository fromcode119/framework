import { RequestContextUtils, SystemConstants } from '@fromcode119/core';
import { UserManagementService } from '@api/services/user-management-service';
import type { IScimListResponse } from '@api/services/interfaces/scim-list-response.interface';
import type { IScimUser } from '@api/services/interfaces/scim-user.interface';

/**
 * SCIM 2.0 user provisioning — the enterprise IdP (Okta, Entra ID, OneLogin) creates, updates and
 * deactivates platform users over the standard SCIM contract, so tenant admins do not hand-manage
 * accounts. Maps the SCIM User resource onto the framework's own `UserManagementService`; additive
 * (never touches the login/session path). `active:false` (the deprovision signal every IdP sends)
 * suspends the account; a hard DELETE removes it.
 */
export class ScimService {
  private static readonly USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
  private static readonly LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';

  constructor(private readonly users: UserManagementService, private readonly db: any) {}

  /**
   * The accounts of the SITE whose IdP is asking — never the platform's.
   *
   * `null` means unrestricted, which is only ever a single-tenant deployment. On a multi-site platform
   * a directory that provisions one customer must not be able to read, rename or deactivate another's
   * people, and the token it authenticated with names exactly one site.
   */
  private async memberIds(): Promise<number[] | null> {
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    if (!tenantId) return null;
    const rows = await this.db
      .find(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: { tenant_id: tenantId } })
      .catch(() => [] as any[]);
    return (Array.isArray(rows) ? rows : [])
      .filter((row: any) => String(row?.state ?? '').trim() === 'active')
      .map((row: any) => Number(row?.user_id))
      .filter((id: number) => Number.isFinite(id) && id > 0);
  }

  /** The account, but only when it belongs to the asking site. Anything else is NOT FOUND. */
  private async scopedUser(id: number): Promise<any | null> {
    const ids = await this.memberIds();
    if (ids && !ids.includes(Number(id))) return null;
    return this.users.getUser(Number(id));
  }

  async list(filter?: string): Promise<IScimListResponse> {
    const all = await this.users.getUsers(await this.memberIds());
    const wanted = this.parseUserNameFilter(filter);
    const matched = wanted
      ? all.filter((u: any) => String(u.email || '').toLowerCase() === wanted)
      : all;
    return {
      schemas: [ScimService.LIST_SCHEMA],
      totalResults: matched.length,
      startIndex: 1,
      itemsPerPage: matched.length,
      Resources: matched.map((u: any) => this.toScim(u)),
    };
  }

  async get(id: string): Promise<IScimUser | null> {
    const user = await this.scopedUser(Number(id));
    return user ? this.toScim(user) : null;
  }

  async create(body: any): Promise<IScimUser> {
    const id = await this.users.saveUser(null, this.fromScim(body, null));
    await this.joinProvisioningSite(Number(id));
    const created = await this.users.getUser(Number(id));
    return this.toScim(created);
  }

  /**
   * A provisioned account BELONGS to the site whose IdP provisioned it.
   *
   * Without the membership the account would exist and be reachable by nobody: a site's people are its
   * members, so the admin who asked their IdP to create the user would not see it, and the user would
   * hold no site at all. The membership records exactly that one fact — this person belongs here — and
   * carries NO roles: what they may do is granted in the admin, deliberately, by a person. Inventing a
   * role here would hand an external directory the power to decide privileges.
   *
   * Untenanted (single-tenant deployment) there is no membership to write, and none is needed.
   */
  private async joinProvisioningSite(userId: number): Promise<void> {
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    if (!tenantId || !Number.isFinite(userId) || userId <= 0) return;
    const existing = await this.db
      .findOne(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { user_id: String(userId), tenant_id: tenantId })
      .catch(() => null);
    if (existing) return;
    await this.db.insert(SystemConstants.TABLE.TENANT_MEMBERSHIPS, {
      userId: String(userId), tenantId, roles: [], state: 'active',
    }).catch(() => undefined);
  }

  async replace(id: string, body: any): Promise<IScimUser | null> {
    const existing = await this.scopedUser(Number(id));
    if (!existing) return null;
    await this.users.saveUser(Number(id), this.fromScim(body, existing));
    return this.toScim(await this.users.getUser(Number(id)));
  }

  /** SCIM PATCH — the deprovision path. Applies each Operation (active / name / userName). */
  async patch(id: string, body: any): Promise<IScimUser | null> {
    const existing = await this.scopedUser(Number(id));
    if (!existing) return null;
    const patch: any = {
      email: existing.email,
      username: existing.username,
      firstName: existing.firstName,
      lastName: existing.lastName,
    };
    const ops: any[] = Array.isArray(body?.Operations) ? body.Operations : [];
    for (const op of ops) {
      const verb = String(op?.op || '').toLowerCase();
      if (verb !== 'replace' && verb !== 'add') continue;
      const path = String(op?.path || '').toLowerCase();
      const value = op?.value;
      if (path === 'active') patch.accountStatus = this.activeToStatus(value);
      else if (path === 'name.givenname') patch.firstName = String(value ?? '');
      else if (path === 'name.familyname') patch.lastName = String(value ?? '');
      else if (path === 'username') patch.email = String(value ?? '');
      else if (!path && value && typeof value === 'object') {
        if ('active' in value) patch.accountStatus = this.activeToStatus(value.active);
        if (value.userName) patch.email = String(value.userName);
        if (value.name?.givenName != null) patch.firstName = String(value.name.givenName);
        if (value.name?.familyName != null) patch.lastName = String(value.name.familyName);
      }
    }
    await this.users.saveUser(Number(id), patch);
    return this.toScim(await this.users.getUser(Number(id)));
  }

  async remove(id: string): Promise<boolean> {
    const existing = await this.scopedUser(Number(id));
    if (!existing) return false;
    await this.users.deleteUser(Number(id));
    return true;
  }

  private toScim(user: any): IScimUser {
    return {
      schemas: [ScimService.USER_SCHEMA],
      id: String(user.id),
      userName: String(user.email || ''),
      name: { givenName: String(user.firstName || ''), familyName: String(user.lastName || '') },
      emails: [{ value: String(user.email || ''), primary: true }],
      active: String(user.accountStatus || 'active') !== 'suspended',
      meta: { resourceType: 'User' },
    };
  }

  private fromScim(body: any, existing: any): any {
    const email = String(body?.userName || body?.emails?.[0]?.value || existing?.email || '').trim();
    const out: any = {
      email,
      username: body?.userName ?? existing?.username ?? null,
      firstName: String(body?.name?.givenName ?? existing?.firstName ?? ''),
      lastName: String(body?.name?.familyName ?? existing?.lastName ?? ''),
      accountStatus: body?.active === false ? 'suspended' : 'active',
    };
    if (body?.password) out.password = String(body.password);
    return out;
  }

  private activeToStatus(value: unknown): string {
    if (value === false || String(value).toLowerCase() === 'false') return 'suspended';
    return 'active';
  }

  private parseUserNameFilter(filter?: string): string | null {
    if (!filter) return null;
    const m = /userName\s+eq\s+"([^"]+)"/i.exec(String(filter));
    return m ? m[1].toLowerCase() : null;
  }
}
