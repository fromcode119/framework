/** Stable keys for the admin page bodies an appearance may override. */
export class AdminPageKeys {
  static readonly DASHBOARD = 'dashboard';
  static readonly COLLECTION_LIST = 'collection-list';
  static readonly COLLECTION_EDIT = 'collection-edit';
  static readonly SETTINGS = 'settings';

  /**
   * The sign-in FRAME — deliberately not "the login page".
   *
   * An appearance may dress the way in (logo, background, layout, its own words) but may never BE the
   * way in. The framework renders the credential form itself and hands it to the frame as `children`;
   * the frame receives no auth capability at all — no `login()`, no token, no user — so the only thing
   * it can do with a sign-in is lay one out. A session still exists only after the server accepts a
   * real `/auth/login` and sets its httpOnly cookie, and `AppearanceSecurityGate` renders this key
   * ONLY on an unauthenticated auth route, so an override can never stand in for the authenticated
   * shell and skip the gate.
   */
  static readonly LOGIN_FRAME = 'login-frame';
}
