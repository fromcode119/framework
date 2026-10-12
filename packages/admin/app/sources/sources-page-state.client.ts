import { AdminComponent } from '@/components/view/admin-component.client';
import { state } from '@fromcode119/react-class-components';
import { SourceRow } from '@/app/sources/source-row';
import { SourceListQuery } from '@/app/sources/source-list-query';
import { SourceStatusFilter } from '@/app/sources/enums/source-status-filter.enum';
import { SourceEditorMode } from '@/app/sources/enums/source-editor-mode.enum';
import type { ISourceUpdateCheck } from '@/app/sources/interfaces/source-update-check.interface';
import type { ListFilter } from '@/components/ui/list-toolbar/list-filter';

/**
 * What the Sources screen holds and what it derives: the sources, what the list is narrowed to, which
 * row is open, and the dialogs in flight. The base of the screen's chain — the actions, then the page.
 *
 * Busy markers hold a row's `<kind>/<slug>` id, never a slug: the same slug can name a plugin AND a
 * theme, and a slug-only comparison spun the button on both rows.
 */
export abstract class SourcesPageState extends AdminComponent {
  static readonly PAGE_SIZE = 50;

  @state builds: any[] = [];
  @state loading = true;
  @state error = '';
  @state search = '';
  @state typeFilter = SourceListQuery.ALL_TYPES;
  @state statusFilter = SourceStatusFilter.ALL;
  @state page = 1;
  @state openId: string | null = null;
  /** The answer of the last "Check updates", which is what marks rows as having new commits. */
  @state updateCheck: ISourceUpdateCheck | null = null;
  @state checking = false;
  @state triggering = false;
  @state buildingId: string | null = null;
  /** The row waiting for "Remove" to be confirmed, and whether that removal is running. */
  @state removing: SourceRow | null = null;
  @state removeBusy = false;
  @state editingBuild: any | null = null;
  @state editorMode: SourceEditorMode | null = null;
  /** A failed save, shown INSIDE the dialog: the page banner sits behind its overlay, out of sight. */
  @state editorError = '';
  @state savingSource = false;

  protected get rows(): SourceRow[] {
    return this.builds.map((build) => SourceRow.from(build, this.updateCheck));
  }

  protected get query(): SourceListQuery {
    return new SourceListQuery(this.search, this.typeFilter, this.statusFilter);
  }

  protected get matchingRows(): SourceRow[] {
    const query = this.query;
    return this.rows.filter((row) => query.matches(row));
  }

  /** Clamped, so a filter that shrinks the list cannot strand the view on an empty page. */
  protected get currentPage(): number {
    return Math.min(this.page, Math.max(1, Math.ceil(this.matchingRows.length / SourcesPageState.PAGE_SIZE)));
  }

  protected get pageRows(): SourceRow[] {
    const start = (this.currentPage - 1) * SourcesPageState.PAGE_SIZE;
    return this.matchingRows.slice(start, start + SourcesPageState.PAGE_SIZE);
  }

  protected abstract get filters(): ListFilter[];
}
