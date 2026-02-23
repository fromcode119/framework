import { LoadedPlugin } from '../../types';
import { PluginManagerInterface } from './utils';
import { SystemTable } from '@fromcode/sdk/internal';

function normalizeRoles(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map((r: any) => String(r ?? '').toLowerCase()).filter(Boolean);
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function toSafeUser(row: any): { id: any; email: string; roles: string[] } {
  return {
    id: row?.id,
    email: String(row?.email ?? '').trim(),
    roles: normalizeRoles(row?.roles)
  };
}

function toProfileUser(row: any): { id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] } | null {
  if (!row) return null;
  const email = String(row?.email ?? '').trim();
  if (!email.includes('@')) return null;
  return {
    id: row.id,
    email,
    username: String(row?.username ?? '').trim(),
    firstName: String(row?.firstName || row?.first_name || '').trim(),
    lastName: String(row?.lastName || row?.last_name || '').trim(),
    roles: normalizeRoles(row?.roles)
  };
}

/**
 * Creates a safe, read-only users proxy for plugins.
 * Plugins should use context.users.* instead of querying the system users table directly.
 */
export function createUsersProxy(
  _plugin: LoadedPlugin,
  manager: PluginManagerInterface
) {
  return {
    async findAdmins(options?: { limit?: number }) {
      const limit = Math.max(1, Math.min(500, options?.limit ?? 200));
      const rows = await manager.db.find(SystemTable.USERS, { limit, orderBy: { created_at: 'desc' } });
      return (Array.isArray(rows) ? rows : [])
        .map(toSafeUser)
        .filter((u) => u.email.includes('@'))
        .filter((u) => u.roles.some((r) => r === 'admin' || r === 'superadmin'));
    },

    async findByRole(role: string, options?: { limit?: number }) {
      const normalizedRole = String(role ?? '').trim().toLowerCase();
      const limit = Math.max(1, Math.min(500, options?.limit ?? 200));
      const rows = await manager.db.find(SystemTable.USERS, { limit, orderBy: { created_at: 'desc' } });
      return (Array.isArray(rows) ? rows : [])
        .map(toSafeUser)
        .filter((u) => u.email.includes('@'))
        .filter((u) => u.roles.includes(normalizedRole));
    },

    async findById(id: any) {
      if (!id) return null;
      const row = await manager.db.findOne(SystemTable.USERS, { id });
      return toProfileUser(row);
    },

    async findByEmail(email: string) {
      const normalized = String(email ?? '').trim().toLowerCase();
      if (!normalized) return null;
      const row = await manager.db.findOne(SystemTable.USERS, { email: normalized });
      return toProfileUser(row);
    }
  };
}
