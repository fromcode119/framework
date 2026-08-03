import type { AuthMode } from '@react/auth/enums/auth-mode.enum';

/** Props for the framework-default AuthShell host. `mode` overrides URL-based detection. */
export interface IAuthShellProps {
  page?: any;
  mode?: AuthMode;
}
