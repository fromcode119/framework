import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * WHERE a plugin's process is started and supervised — shown in the admin, so the operator knows what a
 * deploy of each container does to the plugins.
 *
 * Today there is one place: the api container starts every plugin process itself, so restarting the
 * api restarts all of them.
 */
export class PluginProcessHost extends Enum {
  static readonly API = new PluginProcessHost('api');

  private constructor(value: string) {
    super(value);
  }
}
