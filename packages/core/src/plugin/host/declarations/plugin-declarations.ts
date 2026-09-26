/**
 * The calls through which a plugin DECLARES something to the api — and which therefore have to be
 * declared again to an api that takes over a running plugin process.
 *
 * A plugin's `onInit` fills registries that live only in the api's memory: its collections, its
 * settings schema, its translations, its providers. They used to go to the api as ordinary calls, so
 * nothing in the plugin process knew what it had declared, and an api that attached to a process it
 * did not start would have had none of them. These calls now travel as recorded registrations
 * (`PluginGuestRegistrationKind.DECLARATION`): the api runs them exactly as before, and the process
 * keeps them, so they can be replayed.
 *
 * Only declarations belong here, never writes. Replaying a write would repeat it after the operator
 * may have changed the value since; a declaration only says what the plugin is. Calls that store
 * their result in the database (`people.register`, `settings.set`) already outlive the api and are
 * deliberately NOT listed. `PluginDeclarationsCoverage` (tests) fails when a `register*` method
 * appears on the plugin context without being listed here or there.
 */
export class PluginDeclarations {
  /** `[namespace, method]` on the plugin context. */
  static readonly CALLS: ReadonlyArray<readonly [string, string]> = [
    ['collections', 'register'],
    ['settings', 'register'],
    ['i18n', 'registerTranslations'],
    ['i18n', 'registerTranslationsFromDirectory'],
    ['email', 'registerCategory'],
    ['entityRecords', 'registerProvider'],
    ['integrations', 'registerType'],
    ['integrations', 'registerProvider'],
    ['ui', 'registerHeadInjection'],
    ['people', 'registerSource'],
  ];

  /** Registration-named methods whose effect is stored in the database, so nothing is lost with the api. */
  static readonly PERSISTED: ReadonlyArray<readonly [string, string]> = [
    ['people', 'register'],
  ];

  /** Whether `context.<namespace>.<method>(…)` is one of the declarations. */
  static isDeclaration(namespace: string, method: string): boolean {
    return PluginDeclarations.CALLS.some(([listed, name]) => listed === namespace && name === method);
  }
}
