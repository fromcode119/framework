/**
 * Raised when a role would be given permissions the person saving it does not hold. The role
 * controller answers it with a 403 naming them; nothing else catches it.
 */
export class RoleGrantError extends Error {
  constructor(readonly permissions: string[]) {
    super(`You cannot give a role permissions you do not hold yourself: ${permissions.join(', ')}.`);
    this.name = 'RoleGrantError';
  }
}
