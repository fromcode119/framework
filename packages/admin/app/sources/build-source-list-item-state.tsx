import { AdminComponent } from '@/components/view/admin-component.client';
import { prop, state } from '@fromcode119/react-class-components';

/**
 * One row's own state: which versions it has listed, what it is installing, what it is downloading.
 *
 * The base of this row's chain — the actions, then the markup.
 *
 * A source is identified by KIND and slug together, never by slug alone: the same slug can name a
 * plugin, a theme and an appearance, and a row keyed on the slug would act on whichever of them the
 * list happened to render first.
 */
export abstract class BuildSourceListItemState extends AdminComponent {
  declare props: {
    build: any; deletingKey: string | null; onDelete: (build: any) => void;
    onEdit: (build: any) => void; onTrigger: (build: any) => void; triggerKey: string | null;
  };
  @prop declare build: any;
  @prop declare deletingKey: string | null;
  @prop declare onDelete: (build: any) => void;
  @prop declare onEdit: (build: any) => void;
  @prop declare onTrigger: (build: any) => void;
  @prop declare triggerKey: string | null;

  @state downloading = false;
  /** null until asked for: this is one request per row, and most rows are never expanded. */
  @state versions: { installed: string | null; built: string | null; available: string[] } | null = null;
  @state versionsOpen = false;
  @state loadingVersions = false;
  @state installing: string | null = null;
  @state versionError = '';
  @state chosenVersion = '';
  /** Mirrors the source's own setting so the toggle reflects a save without refetching the list. */
  @state autoUpdating: boolean | null = null;
  @state savingAutoUpdate = false;

  /** This row's identity. A slug alone matches the plugin AND the theme that share it. */
  get identityKey(): string {
    return `${String(this.build?.type ?? '')}/${String(this.build?.slug ?? '')}`;
  }

  /** The source's setting, or the local override once it has been changed here. */
  get autoUpdateEnabled(): boolean {
    return this.autoUpdating ?? Boolean(this.build?.autoUpdate);
  }

  /**
   * What this source has produced, in the terms the operator asked for it.
   *
   * It used to read the ARCHIVE's filename and say "waiting for first successful build" when there
   * was none — which became a lie the moment a build stopped writing an archive: the build had
   * succeeded, and the screen said it had not happened. The package is the thing; the zip is a
   * download somebody may never ask for.
   */
  get packageLabel(): string {
    if (this.build.fileName) return `Archive: ${this.build.fileName}`;
    const version = String(this.build.version || '').trim();
    if (version && this.build.lastBuildStatus === 'success') {
      return `Package: ${this.build.slug} ${version} — built and ready`;
    }
    return 'Package: waiting for first successful build';
  }
}
