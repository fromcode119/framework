import { ApiPathUtils } from '../api/api-path-utils';
import { SystemConstants } from '../constants';

export class AdminUserClient {
  constructor(
    private readonly requester: {
      get: (path: string, options?: any) => Promise<any>;
    },
  ) {}

  async findByReference(value: any, options?: any): Promise<any | null> {
    const reference = AdminUserClient.extractReference(value);
    if (!reference.key) {
      return null;
    }

    if (reference.id) {
      const payload = await this.requester.get(
        AdminUserClient.buildUserPath(reference.id),
        options,
      );
      return AdminUserClient.unwrapUserPayload(payload);
    }

    const payload = await this.requester.get(
      ApiPathUtils.versioned(SystemConstants.API_PATH.SYSTEM.ADMIN_USERS),
      options,
    );
    const users = AdminUserClient.extractUsers(payload);
    if (users.length === 0) {
      return null;
    }

    const normalizedKey = reference.key.toLowerCase();
    return (
      users.find((user: any) => AdminUserClient.matchesReference(user, normalizedKey)) || null
    );
  }

  static extractReference(value: any): { id?: number; key: string } {
    if (value === null || value === undefined || value === '') {
      return { key: '' };
    }

    if (Array.isArray(value)) {
      return value.length > 0
        ? AdminUserClient.extractReference(value[0])
        : { key: '' };
    }

    if (typeof value === 'object') {
      const nestedValue =
        value.id ?? value.value ?? value.email ?? value.username ?? value.slug ?? '';
      return AdminUserClient.extractReference(nestedValue);
    }

    const normalizedValue = String(value).trim();
    if (!normalizedValue) {
      return { key: '' };
    }

    const numericValue = Number(normalizedValue);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      const normalizedId = Math.trunc(numericValue);
      return { id: normalizedId, key: String(normalizedId) };
    }

    return { key: normalizedValue };
  }

  static resolveDisplayName(user: any): string {
    const firstName = String(user?.firstName || user?.first_name || '').trim();
    const lastName = String(user?.lastName || user?.last_name || '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || String(user?.username || user?.email || '').trim();
  }

  private static buildUserPath(userId: number): string {
    return ApiPathUtils.versioned(
      ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_USER, { id: userId }),
    );
  }

  private static unwrapUserPayload(payload: any): any | null {
    return payload?.doc || payload?.user || payload || null;
  }

  private static extractUsers(payload: any): any[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    return Array.isArray(payload?.docs) ? payload.docs : [];
  }

  private static matchesReference(user: any, reference: string): boolean {
    const email = String(user?.email || '').toLowerCase();
    const username = String(user?.username || '').toLowerCase();
    const id = String(user?.id || '').toLowerCase();
    return reference === email || reference === username || reference === id;
  }
}
