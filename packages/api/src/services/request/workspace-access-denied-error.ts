/**
 * Raised while a session is being minted on a WORKSPACE host for an account that is not a member of
 * that workspace. The login handlers turn it into a 403 with its name; nothing else catches it.
 */
export class WorkspaceAccessDeniedError extends Error {
  static readonly CODE = 'workspace_access_denied';

  constructor(readonly workspaceSlug: string) {
    super(`This account is not a member of the "${workspaceSlug}" workspace.`);
    this.name = 'WorkspaceAccessDeniedError';
  }
}
