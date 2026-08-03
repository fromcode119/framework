import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, bound, prop, state, ref, watch } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';
import { TagFieldUtils } from '@/components/ui/tag-field/utils';
import { TagFieldDataService } from '@/components/ui/tag-field/data-service';
import { TagFieldChips } from '@/components/ui/tag-field/view/chips.client';
import { TagFieldSuggestions } from '@/components/ui/tag-field/view/suggestions.client';
import type { ITagOption } from '@/components/ui/tag-field/interfaces/tag-option.interface';
import type { ITagFieldProps } from '@/components/ui/tag-field/interfaces/tag-field-props.interface';

export class TagField extends Reactor {
  declare props: Pick<ITagFieldProps, keyof ITagFieldProps>;
  @prop declare value: string[] | string;
  @prop declare onChange: (value: string[] | string) => void;
  @prop declare placeholder?: string;
  @prop declare suggestionsLabel?: string;
  @prop declare theme?: ThemeMode;
  @prop declare collectionSlug?: string;
  @prop declare fieldName?: string;
  @prop declare sourceCollection?: string;
  @prop declare sourceField?: string;
  @prop declare hasMany?: boolean;
  @prop declare allowCreate?: boolean;
  @prop declare size?: FieldSize;

  @ref private declare containerRef: Ref<HTMLDivElement>;
  private suggestTimer?: ReturnType<typeof setTimeout>;

  @state inputValue = '';
  @state suggestions: ITagOption[] = [];
  @state showSuggestions = false;
  @state sourceUnavailableMessage = '';
  @state labels: Record<string, string> = {};
  @state isCreating = false;

  private getTags(): any[] {
    return TagFieldDataService.parseTags(this.value, this.hasMany ?? true);
  }

  componentDidMount(): void {
    document.addEventListener('mousedown', this.handleClickOutside);
    void this.fetchLabels();
    this.scheduleFetchSuggestions();
  }

  // ----- side-effects (mirror the original effect dependency arrays) -----
  @watch('value', 'sourceCollection', 'sourceUnavailableMessage')
  private onLabelsDepsChanged(): void {
    void this.fetchLabels();
  }

  @watch('inputValue', 'collectionSlug', 'fieldName', 'value', 'sourceCollection', 'sourceField', 'showSuggestions')
  private onSuggestionsDepsChanged(): void {
    this.scheduleFetchSuggestions();
  }

  componentWillUnmount(): void {
    document.removeEventListener('mousedown', this.handleClickOutside);
    if (this.suggestTimer) clearTimeout(this.suggestTimer);
  }

  @bound
  private handleClickOutside(event: MouseEvent): void {
    if (this.containerRef.current && !this.containerRef.current.contains(event.target as Node)) {
      this.showSuggestions = false;
    }
  }

  private scheduleFetchSuggestions(): void {
    if (this.suggestTimer) clearTimeout(this.suggestTimer);
    this.suggestTimer = setTimeout(() => { void this.fetchSuggestions(); }, 300);
  }

  private async fetchLabels(): Promise<void> {
    await TagFieldDataService.fetchLabels({
      props: this.props,
      tags: this.getTags(),
      labels: this.labels,
      sourceUnavailableMessage: this.sourceUnavailableMessage,
      setSourceUnavailable: (message) => { this.sourceUnavailableMessage = message; },
      mergeLabels: (labels) => { this.labels = { ...this.labels, ...labels }; },
    });
  }

  private async fetchSuggestions(): Promise<void> {
    await TagFieldDataService.fetchSuggestions({
      props: this.props,
      inputValue: this.inputValue,
      sourceUnavailableMessage: this.sourceUnavailableMessage,
      tags: this.getTags(),
      setSuggestions: (suggestions) => { this.suggestions = suggestions; },
      setSourceUnavailable: (message) => { this.sourceUnavailableMessage = message; },
      setSourceUnavailableWithSuggestions: (message) => { this.sourceUnavailableMessage = message; this.suggestions = []; },
      mergeLabels: (labels) => { this.labels = { ...this.labels, ...labels }; },
    });
  }

  private addTag(tag: any): void {
    const onChange = this.onChange;
    const hasMany = this.hasMany ?? true;
    const tags = this.getTags();
    if (tag === null || tag === undefined) return;
    const strValue = String(tag).trim();
    if (!strValue) return;

    if (hasMany && tags.includes(strValue)) {
      this.inputValue = '';
      this.showSuggestions = false;
      return;
    }

    if (hasMany) {
      onChange([...tags, strValue]);
    } else {
      onChange(strValue);
    }

    this.inputValue = '';
    this.showSuggestions = false;

    void TagFieldDataService.autoCreate(this.props, strValue);
  }

  @bound
  private handleAddClick(tag: any): void {
    // Direct synchronous call to ensure state transitions happen immediately
    this.addTag(tag);
  }

  render(): ReactNode {
    const fieldName = this.fieldName;
    const sourceCollection = this.sourceCollection;
    const theme = this.theme ?? ThemeMode.LIGHT;
    const hasMany = this.hasMany ?? true;
    const allowCreate = this.allowCreate ?? true;
    const size = this.size ?? FieldSize.MD;
    const onChange = this.onChange;
    const { inputValue, suggestions, showSuggestions, sourceUnavailableMessage, labels, isCreating } = this;
    const tags = this.getTags();
    const inferredFieldLabel = TagFieldUtils.inferFieldLabel(fieldName);
    const effectivePlaceholder = this.placeholder || (sourceCollection ? `Search ${inferredFieldLabel}...` : `Add ${inferredFieldLabel} and press Enter...`);
    const effectiveSuggestionsLabel = this.suggestionsLabel || `Existing ${inferredFieldLabel}`;

    return (
    <div className="relative w-full" ref={this.containerRef}>
      <TagFieldChips
        theme={theme}
        size={size}
        tags={tags}
        labels={labels}
        sourceCollection={sourceCollection}
        hasMany={hasMany}
        isCreating={isCreating}
        inputValue={inputValue}
        effectivePlaceholder={effectivePlaceholder}
        onChange={onChange}
        onInputChange={(value) => { this.inputValue = value; this.showSuggestions = true; }}
        onShowSuggestions={() => { this.showSuggestions = true; }}
        onAdd={this.handleAddClick}
      />

      <TagFieldSuggestions
        theme={theme}
        inputValue={inputValue}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        sourceUnavailableMessage={sourceUnavailableMessage}
        sourceCollection={sourceCollection}
        suggestionsLabel={effectiveSuggestionsLabel}
        createEntityLabel={inferredFieldLabel}
        allowCreate={allowCreate}
        onAdd={this.handleAddClick}
      />
    </div>
    );
  }
}
