import { LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from './utils.interfaces';
import { SystemConstants } from '../../constants';

export class UsersContextProxy {

  /**
   * Creates a safe, read-only users proxy for plugins.
   * Plugins should use context.users.* instead of querying the system users table directly.
   */
  static createUsersProxy(
    _plugin: LoadedPlugin,
    manager: PluginManagerInterface
  ) {
    return {
      async findAdmins(options?: { limit?: number }) {
        const limit = Math.max(1, Math.min(500, options?.limit ?? 200));
        const rows = await manager.db.find(SystemConstants.TABLE.USERS, { limit, orderBy: { created_at: 'desc' } });
        return (Array.isArray(rows) ? rows : [])
          .map(UsersContextProxy.toSafeUser)
          .filter((u) => u.email.includes('@'))
          .filter((u) => u.roles.some((r) => r === 'admin' || r === 'superadmin'));
      },

      async findByRole(role: string, options?: { limit?: number }) {
        const normalizedRole = String(role ?? '').trim().toLowerCase();
        const limit = Math.max(1, Math.min(500, options?.limit ?? 200));
        const rows = await manager.db.find(SystemConstants.TABLE.USERS, { limit, orderBy: { created_at: 'desc' } });
        return (Array.isArray(rows) ? rows : [])
          .map(UsersContextProxy.toSafeUser)
          .filter((u) => u.email.includes('@'))
          .filter((u) => u.roles.includes(normalizedRole));
      },

      async findById(id: any) {
        if (!id) return null;
        const row = await manager.db.findOne(SystemConstants.TABLE.USERS, { id });
        return UsersContextProxy.toProfileUser(row);
      },

      async findByEmail(email: string) {
        const normalized = String(email ?? '').trim().toLowerCase();
        if (!normalized) return null;
        const row = await manager.db.findOne(SystemConstants.TABLE.USERS, { email: normalized });
        return UsersContextProxy.toProfileUser(row);
      },

      /** List users (safe profiles, newest first) — for generic "any user" needs without raw table access. */
      async list(options?: { limit?: number }): Promise<Array<{ id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] }>> {
        const limit = Math.max(1, Math.min(500, options?.limit ?? 100));
        const rows = await manager.db.find(SystemConstants.TABLE.USERS, { limit, orderBy: { created_at: 'desc' } });
        const out: Array<{ id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] }> = [];
        for (const row of Array.isArray(rows) ? rows : []) {
          const profile = UsersContextProxy.toProfileUser(row);
          if (profile) out.push(profile);
        }
        return out;
      },

      /**
       * Create a user through the framework (plugins must NOT insert into the `users` system table via
       * context.db — that path is blocked). The caller passes an ALREADY-HASHED password (hash it with
       * context.auth.hashPassword); the framework owns the only write to the users table. Idempotent:
       * returns the existing user's id if the email is already taken.
       */
      async create(input: { email: string; password: string; roles?: string[]; firstName?: string; lastName?: string }): Promise<{ id: any } | null> {
        const email = String(input?.email ?? '').trim().toLowerCase();
        if (!email.includes('@')) return null;
        const existing = await manager.db.findOne(SystemConstants.TABLE.USERS, { email });
        if (existing?.id != null) return { id: existing.id };
        const row: any = await manager.db.insert(SystemConstants.TABLE.USERS, {
          email,
          password: String(input?.password ?? ''),
          roles: Array.isArray(input?.roles) && input.roles.length ? input.roles : ['customer'],
          firstName: input?.firstName ? String(input.firstName) : null,
          lastName: input?.lastName ? String(input.lastName) : null,
        });
        const created = Array.isArray(row) ? row[0] : row;
        return created?.id != null ? { id: created.id } : null;
      }
    };

  }

  // ---------------------------------------------------------------------------
  // Private static helpers (implementation details — not part of public API)
  // ---------------------------------------------------------------------------

  private static normalizeRoles(raw: any): string[] {
    if (Array.isArray(raw)) return raw.map((r: any) => String(r ?? '').toLowerCase()).filter(Boolean);
    if (typeof raw === 'string') {
      return raw
        .split(',')
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean);
    }
    return [];
  }

  private static toSafeUser(row: any): { id: any; email: string; roles: string[] } {
    return {
      id: row?.id,
      email: String(row?.email ?? '').trim(),
      roles: UsersContextProxy.normalizeRoles(row?.roles)
    };
  }

  private static toProfileUser(row: any): { id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] } | null {
    if (!row) return null;
    const email = String(row?.email ?? '').trim();
    if (!email.includes('@')) return null;
    return {
      id: row.id,
      email,
      username: String(row?.username ?? '').trim(),
      firstName: String(row?.firstName || row?.first_name || '').trim(),
      lastName: String(row?.lastName || row?.last_name || '').trim(),
      roles: UsersContextProxy.normalizeRoles(row?.roles)
    };
  }
}