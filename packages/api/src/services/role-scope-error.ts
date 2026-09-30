/**
 * Raised when a role is written from a scope that does not own it: a PLATFORM role from inside a site,
 * or from platform scope by someone who is not a platform admin. The role controller answers it with a
 * 403 and this message; nothing else catches it.
 */
export class RoleScopeError extends Error {
  readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = 'RoleScopeError';
  }
}
