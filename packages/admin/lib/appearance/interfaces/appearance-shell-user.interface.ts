
/** The authed admin user, passed read-only so an appearance shell can render account chrome. */
export interface IAppearanceShellUser {
  email: string;
  name?: string;
  roles?: string[];
}
