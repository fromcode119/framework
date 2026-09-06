/**
 * The appearance a PLATFORM admin chose for this session when opening a workspace from the shared
 * admin host (T6 §3.3): the workspace's own appearance ("open as") or the default console
 * ("configure"). Decided by the runtime loader from the session's `mode` claim; `null` outside a
 * workspace tenant, where the site's `admin_appearance` setting applies as before.
 */
export class SessionAppearanceChoice {
  private static choice: string | null = null;

  static set(appearanceId: string): void {
    SessionAppearanceChoice.choice = appearanceId || 'default';
  }

  static clear(): void {
    SessionAppearanceChoice.choice = null;
  }

  static get current(): string | null {
    return SessionAppearanceChoice.choice;
  }
}
