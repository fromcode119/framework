import { CoercionUtils } from '@fromcode119/core/client';

/** One account's membership of one site, with the roles it holds THERE. */
export class SiteMember {
  private constructor(readonly userId: string, readonly email: string, readonly roles: string[], readonly state: string) {}

  get isAdmin(): boolean {
    return this.roles.includes('admin');
  }

  static from(raw: unknown): SiteMember {
    const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
    return new SiteMember(
      CoercionUtils.toString(input.userId),
      CoercionUtils.toString(input.email),
      Array.isArray(input.roles) ? input.roles.map((r: unknown) => CoercionUtils.toString(r)) : [],
      CoercionUtils.toString(input.state) || 'active',
    );
  }
}
