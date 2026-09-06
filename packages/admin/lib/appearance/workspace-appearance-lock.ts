/**
 * Whether the console this session runs in is LOCKED to an appearance by the tenant's kind (T6 §3.3):
 * on a workspace domain the appearance is not a setting, so nothing offers a way to switch it —
 * the Appearance page shows the lock, the containment screen hides its "open standard admin" link.
 * Set once by the AppearanceRuntimeLoader for the life of the page; never persisted.
 */
export class WorkspaceAppearanceLock {
  private static lockedTo: string | null = null;
  private static workspaceSlug = '';

  static lock(appearance: string, workspaceSlug: string): void {
    WorkspaceAppearanceLock.lockedTo = appearance || 'default';
    WorkspaceAppearanceLock.workspaceSlug = workspaceSlug;
  }

  static clear(): void {
    WorkspaceAppearanceLock.lockedTo = null;
    WorkspaceAppearanceLock.workspaceSlug = '';
  }

  static get locked(): boolean {
    return WorkspaceAppearanceLock.lockedTo !== null;
  }

  static get appearance(): string {
    return WorkspaceAppearanceLock.lockedTo ?? '';
  }

  static get slug(): string {
    return WorkspaceAppearanceLock.workspaceSlug;
  }
}
