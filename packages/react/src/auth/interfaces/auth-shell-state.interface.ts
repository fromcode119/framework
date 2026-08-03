import type { AuthMode } from '@react/auth/enums/auth-mode.enum';

/** Runtime state of the AuthShell: the active surface and any detected existing session. */
export interface IAuthShellState {
  mode: AuthMode;
  signedInUser: any | null;
}
