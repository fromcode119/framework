import { Enum } from '@fromcode119/reactor';
import { RouteConstants } from '@fromcode119/core/client';

/**
 * The auth surface (login / register / forgot / reset) as a method-bearing reactor `Enum`. It is a UI-only
 * routing discriminator — never persisted or JSON-serialized; the value only maps to/from a URL PATH SEGMENT.
 * Each member owns its `path`, so the mode↔path mapping (previously duplicated across `readModeFromUrl` and
 * `pathForMode`) lives in one place.
 */
export class AuthMode extends Enum {
  static readonly LOGIN = new AuthMode('login', RouteConstants.SEGMENTS.LOGIN);
  static readonly REGISTER = new AuthMode('register', RouteConstants.SEGMENTS.REGISTER);
  static readonly FORGOT = new AuthMode('forgot', RouteConstants.SEGMENTS.FORGOT_PASSWORD);
  static readonly RESET = new AuthMode('reset', RouteConstants.SEGMENTS.RESET_PASSWORD);

  private constructor(value: string, readonly path: string) {
    super(value);
  }

  /** Resolve the mode from a URL pathname (suffix match); defaults to LOGIN. */
  static fromPath(pathname: string): AuthMode {
    const path = String(pathname || '');
    for (const mode of [AuthMode.REGISTER, AuthMode.FORGOT, AuthMode.RESET]) {
      if (path.endsWith(mode.path)) return mode;
    }
    return AuthMode.LOGIN;
  }
}
