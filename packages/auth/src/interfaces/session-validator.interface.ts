/** Validates whether a session (by jti) is still active. */
export interface ISessionValidator {
  (jti: string): Promise<boolean>;
}
