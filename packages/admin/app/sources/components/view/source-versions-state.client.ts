import { AdminComponent } from '@/components/view/admin-component.client';
import { prop, state } from '@fromcode119/react-class-components';

/**
 * One source's version panel state: what is installed, what was built, what can be installed, and
 * whether it keeps itself current.
 *
 * The base of the panel's chain — the actions, then the markup.
 *
 * A source is identified by KIND and slug together, never by slug alone: the same slug can name a
 * plugin, a theme and an appearance.
 */
export abstract class SourceVersionsState extends AdminComponent {
  declare props: { build: any };
  @prop declare build: any;

  /** null until read: the panel mounts only when its row is opened, and reads then. */
  @state versions: { installed: string | null; built: string | null; available: string[] } | null = null;
  @state loadingVersions = true;
  @state installing: string | null = null;
  @state versionError = '';
  @state chosenVersion = '';
  /** Mirrors the source's own setting so the toggle reflects a save without refetching the list. */
  @state autoUpdating: boolean | null = null;
  @state savingAutoUpdate = false;

  protected get type(): string {
    return String(this.build?.type ?? '');
  }

  protected get slug(): string {
    return String(this.build?.slug ?? '');
  }

  /** The source's setting, or the local override once it has been changed here. */
  get autoUpdateEnabled(): boolean {
    return this.autoUpdating ?? Boolean(this.build?.autoUpdate);
  }

  /** INSTALLED and BUILT differ: that difference is what the operator came to find out. */
  get versionsDiffer(): boolean {
    return Boolean(this.versions?.installed && this.versions?.built && this.versions.installed !== this.versions.built);
  }
}
