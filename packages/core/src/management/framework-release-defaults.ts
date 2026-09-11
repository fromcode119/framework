/**
 * Where this framework publishes its own releases.
 *
 * Its own file because BOTH sides need it and they cannot share a module: the service that performs
 * the check reads platform settings and therefore touches the database, which must never be pulled
 * into the admin bundle — and the admin has to state the default beside the field that overrides it,
 * or the operator cannot tell what "blank" means.
 */
export class FrameworkReleaseDefaults {
  /** A fact about this software, in the same sense as its name. A fork replaces it in Settings. */
  static readonly REPOSITORY = 'fromcode119/framework';
}
