import { FieldType, IPluginSettingsSchema } from '@fromcode119/sdk';

/**
 * Where the build agent does its work.
 *
 * It used to resolve `source/`, `core/`, `plugins/` and `themes/` against `process.cwd()`. Inside the
 * api container that is `/app`, which the app user cannot write — so it failed with EACCES on every
 * boot — and worse, `/app/plugins` and `/app/themes` are the LIVE mounted repositories, so succeeding
 * would have written build output over the very sources it is meant to package.
 *
 * A declared setting instead: the operator can see where builds land and change it, and the default is
 * a writable directory the framework already owns.
 */
export class SourcesSettingsSchema {
  static getSettingsSchema(t: (key: string, fallback: string) => string): IPluginSettingsSchema {
    return {
      fields: [
        {
          name: 'workspaceRoot',
          label: t('settings.workspaceRoot.label', 'Build workspace'),
          type: FieldType.TEXT,
          defaultValue: '',
          admin: {
            description: t(
              'settings.workspaceRoot.description',
              'Absolute path the agent clones into and writes packages to. Leave empty to use '
              + '<data>/sources, which is writable and separate from the installed plugins and themes. '
              + 'Never point this at the directory the platform loads plugins or themes from.',
            ),
          },
        },
      ],
    };
  }
}
