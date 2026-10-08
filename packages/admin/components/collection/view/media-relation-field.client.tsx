import { ThemeMode } from '@fromcode119/core/client';
import type React from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { MediaRelationPreviewResolver } from '@/components/collection/media-relation-preview-resolver';
import { MediaRelationFieldUtils } from '@/components/collection/media-relation-field-utils';
import { MediaRelationFieldView } from '@/components/collection/view/media-relation-field-view.client';
import type { IMediaRelationPreview } from '@/components/collection/interfaces/media-relation-preview.interface';

export class MediaRelationField extends Reactor {
  @prop declare value: any;
  @prop declare onChange: (val: any) => void;
  @prop declare theme: ThemeMode;
  @prop declare hasMany?: boolean;
  /** Show the whole picked image instead of filling the box — a logo must not be cropped. */
  @prop declare wholeImage?: boolean;

  @state open = false;
  /** One per selected file, in the stored order. */
  @state previews: IMediaRelationPreview[] = [];

  private hydrateToken = 0;

  private getSelectedIds(): Array<string | number> {
    return MediaRelationFieldUtils.getSelectedIds(this.value);
  }

  @bound private async hydratePreviews(): Promise<void> {
    const token = ++this.hydrateToken;
    const ids = this.getSelectedIds().map(String);
    const known = new Map(this.previews.map((preview) => [String(preview.id), preview]));
    if (ids.every((id) => known.get(id)?.url)) {
      this.previews = ids.map((id) => known.get(id)!);
      return;
    }
    const resolved = await Promise.all(ids.map((id) => known.get(id)?.url ? known.get(id)! : MediaRelationPreviewResolver.resolve(id)));
    if (token !== this.hydrateToken) return;
    this.previews = resolved.filter((preview): preview is IMediaRelationPreview => Boolean(preview));
  }

  componentDidMount(): void {
    void this.hydratePreviews();
  }

  componentDidUpdate(prevProps: { value: any }): void {
    if (prevProps.value !== this.value) void this.hydratePreviews();
  }

  componentWillUnmount(): void {
    // Invalidate any in-flight hydrate so it can't setState after unmount.
    this.hydrateToken++;
  }

  @bound private handleSelect(item: any): void {
    const selectedId = item?.id || item?._id || item;
    if (!selectedId) return;
    const preview = { id: String(selectedId), url: item.url, filename: item.filename, mimeType: item.mimeType };
    this.previews = this.hasMany
      ? [...this.previews.filter((existing) => existing.id !== preview.id), preview]
      : [preview];
    this.onChange(MediaRelationFieldUtils.withSelected(this.getSelectedIds(), selectedId, Boolean(this.hasMany)));
  }

  @bound private handleRemove(id: string): void {
    this.previews = this.previews.filter((preview) => preview.id !== id);
    this.onChange(MediaRelationFieldUtils.withoutSelected(this.getSelectedIds(), id, Boolean(this.hasMany)));
  }

  @bound private handleOpenChange(v: boolean): void {
    this.open = v;
  }

  render(): React.ReactNode {
    return (
      <MediaRelationFieldView
        wholeImage={Boolean(this.wholeImage)}
        theme={this.theme}
        hasMany={Boolean(this.hasMany)}
        open={this.open}
        previews={this.previews}
        selectedIds={this.getSelectedIds()}
        onOpenChange={this.handleOpenChange}
        onSelect={this.handleSelect}
        onRemove={this.handleRemove}
      />
    );
  }
}
