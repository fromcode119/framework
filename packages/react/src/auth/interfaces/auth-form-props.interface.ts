import type { AuthMode } from '@react/auth/enums/auth-mode.enum';

/** Shared props every auth form receives so it can hand control back to the shell for mode switching. */
export interface IAuthFormProps {
  /** Client-side switch to another auth surface (login ⇄ register ⇄ forgot). */
  onSwitchMode?: (mode: AuthMode) => void;
  /**
   * The document locale the route resolved on the server. A server render has no `<html lang>` to read,
   * so without it the server paints English and the browser repaints in the site's language.
   */
  documentLocale?: string;
}
