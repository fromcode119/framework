import type { IUser } from '@/components/interfaces/user.interface';

/**
 * May this admin act on the PLATFORM — the one container every site runs on?
 *
 * On a multi-tenant deployment the `admin` role means "admin of my site", and installing code,
 * deleting a plugin or activating a theme is not a site action. The API refuses those with
 * `platform_admin_required`; this is the same rule on the client, so the admin HIDES the controls
 * instead of rendering a button that fails when pressed — a control that cannot act is a bug, not a
 * hint.
 *
 * Both flags travel on the user payload from `/auth/login` and `/auth/security`, so the answer is
 * known before any page renders and needs no extra round-trip. On a single-tenant deployment
 * `multiTenant` is false and every admin is the platform, exactly as before tenancy existed.
 */
export class PlatformAccess {
  static canManagePlatform(user: IUser | null | undefined): boolean {
    if (!user) return false;
    // FAIL CLOSED. `multiTenant === false` is the single-tenant deployment, where every admin is the
    // platform. `undefined` is NOT that: it is a user object written before these flags existed — a
    // pre-upgrade cookie on a warm session — and the first build of this rule read it as "not
    // multi-tenant" and showed a tenant admin every platform control. Unknown means no; the API refuses
    // anyway, and the next login or refresh fills the flag in.
    if (user.multiTenant === false) return true;
    return user.platformAdmin === true;
  }
}
