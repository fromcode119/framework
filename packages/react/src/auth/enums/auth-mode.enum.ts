import { Enum } from '@fromcode119/react-class-components';
import { FrameworkPageRecipe, RouteConstants } from '@fromcode119/core/client';

/**
 * The auth surface (login / register / forgot / reset) as a method-bearing reactor `Enum`. It is a UI-only
 * routing discriminator — never persisted or JSON-serialized; the value only maps to/from a URL PATH SEGMENT.
 * Each member owns its `path`, so the mode↔path mapping (previously duplicated across `readModeFromUrl` and
 * `pathForMode`) lives in one place.
 */
export class AuthMode extends Enum {
  static readonly LOGIN = new AuthMode('login', RouteConstants.SEGMENTS.LOGIN, FrameworkPageRecipe.LOGIN);
  static readonly REGISTER = new AuthMode('register', RouteConstants.SEGMENTS.REGISTER, FrameworkPageRecipe.REGISTER);
  static readonly FORGOT = new AuthMode('forgot', RouteConstants.SEGMENTS.FORGOT_PASSWORD, FrameworkPageRecipe.FORGOT_PASSWORD);
  static readonly RESET = new AuthMode('reset', RouteConstants.SEGMENTS.RESET_PASSWORD, FrameworkPageRecipe.RESET_PASSWORD);
  static readonly VERIFY = new AuthMode('verify', RouteConstants.SEGMENTS.VERIFY_EMAIL, FrameworkPageRecipe.VERIFY_EMAIL);

  private constructor(
    value: string,
    readonly path: string,
    /** The page recipe a site page for this surface carries (`FrameworkPageDesigns` renders it). */
    readonly recipe: string,
  ) {
    super(value);
  }

  /** Every surface, for the page-design registration and the storefront's path table. */
  static all(): AuthMode[] {
    return [AuthMode.LOGIN, AuthMode.REGISTER, AuthMode.FORGOT, AuthMode.RESET, AuthMode.VERIFY];
  }

  /** The surface a page recipe names, or null for a recipe that is not an auth surface. */
  static fromRecipe(recipe: unknown): AuthMode | null {
    const value = String(recipe || '').trim();
    return AuthMode.all().find((mode) => mode.recipe === value) ?? null;
  }

  /** Token links (reset, verify) are fresh actions even for a signed-in visitor. */
  get isTokenLink(): boolean {
    return this === AuthMode.RESET || this === AuthMode.VERIFY;
  }

  /** Resolve the mode from a URL pathname (suffix match); defaults to LOGIN. */
  static fromPath(pathname: string): AuthMode {
    const path = String(pathname || '');
    for (const mode of [AuthMode.REGISTER, AuthMode.FORGOT, AuthMode.RESET, AuthMode.VERIFY]) {
      if (path.endsWith(mode.path)) return mode;
    }
    return AuthMode.LOGIN;
  }
}
