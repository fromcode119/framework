import type { AuthMode } from '@react/auth/enums/auth-mode.enum';

/** Shared props every auth form receives so it can hand control back to the shell for mode switching. */
export interface IAuthFormProps {
  /** Client-side switch to another auth surface (login ⇄ register ⇄ forgot). */
  onSwitchMode?: (mode: AuthMode) => void;
}
