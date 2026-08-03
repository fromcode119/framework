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

  constructor(private readonly users: UserManagementService) {}

  async list(filter?: string): Promise<IScimListResponse> {
    const all = await this.users.getUsers();
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
    const user = await this.users.getUser(Number(id));
    return user ? this.toScim(user) : null;
  }

  async create(body: any): Promise<IScimUser> {
    const id = await this.users.saveUser(null, this.fromScim(body, null));
    const created = await this.users.getUser(Number(id));
    return this.toScim(created);
  }

  async replace(id: string, body: any): Promise<IScimUser | null> {
    const existing = await this.users.getUser(Number(id));
    if (!existing) return null;
    await this.users.saveUser(Number(id), this.fromScim(body, existing));
    return this.toScim(await this.users.getUser(Number(id)));
  }

  /** SCIM PATCH — the deprovision path. Applies each Operation (active / name / userName). */
  async patch(id: string, body: any): Promise<IScimUser | null> {
    const existing = await this.users.getUser(Number(id));
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
    const existing = await this.users.getUser(Number(id));
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
