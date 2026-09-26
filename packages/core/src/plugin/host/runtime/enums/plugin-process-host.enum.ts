import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * WHERE a plugin's process is started and supervised — shown in the admin, so the operator knows what a
 * deploy of each container does to the plugins.
 *
 * Either the api container starts them itself, or the `extension-host` container does
 * (`EXTENSION_HOST_SOCKET` on the api). In both, restarting the api still restarts its plugin processes.
 */
export class PluginProcessHost extends Enum {
  static readonly API = new PluginProcessHost('api');
  static readonly EXTENSION_HOST = new PluginProcessHost('extension-host');

  private constructor(value: string) {
    super(value);
  }
}
