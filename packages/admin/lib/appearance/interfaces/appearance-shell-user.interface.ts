
/** The authed admin user, passed read-only so an appearance shell can render account chrome. */
export interface IAppearanceShellUser {
  email: string;
  name?: string;
  roles?: string[];
  /** May act on the platform, so a shell may offer stepping out of the site to it (`PlatformAccess`). */
  canManagePlatform?: boolean;
}
