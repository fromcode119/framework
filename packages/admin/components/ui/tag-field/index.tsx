"use client";

import React from 'react';
import { TagFieldUtils } from './utils';
import { TagFieldDataService } from './data-service';
import { TagFieldChips } from './chips';
import { TagFieldSuggestions } from './suggestions';
import type { TagFieldProps, TagFieldState } from './interfaces';

export class TagField extends React.Component<TagFieldProps, TagFieldState> {
  private readonly containerRef = React.createRef<HTMLDivElement>();
  private suggestTimer?: ReturnType<typeof setTimeout>;

  state: TagFieldState = {
    inputValue: '',
    suggestions: [],
    showSuggestions: false,
    sourceUnavailableMessage: '',
    labels: {},
    isCreating: false,
  };

  private getTags(): any[] {
    return TagFieldDataService.parseTags(this.props.value, this.props.hasMany ?? true);
  }

  private tagsFromProps(props: TagFieldProps): any[] {
    return TagFieldDataService.parseTags(props.value, props.hasMany ?? true);
  }

  // ----- side-effect keys (mirror the original effect dependency arrays) -----
  private labelsEffectKey(): string {
    return JSON.stringify([this.getTags(), this.props.sourceCollection, this.state.sourceUnavailableMessage]);
  }

  private suggestionsEffectKey(): string {
    return JSON.stringify([
      this.state.inputValue,
      this.props.collectionSlug,
      this.props.fieldName,
      this.getTags(),
      this.props.sourceCollection,
      this.props.sourceField,
      this.state.showSuggestions,
    ]);
  }

  componentDidMount(): void {
    document.addEventListener('mousedown', this.handleClickOutside);
    void this.fetchLabels();
    this.scheduleFetchSuggestions();
  }

  componentDidUpdate(prevProps: TagFieldProps, prevState: TagFieldState): void {
    const prevLabelsKey = JSON.stringify([this.tagsFromProps(prevProps), prevProps.sourceCollection, prevState.sourceUnavailableMessage]);
    if (prevLabelsKey !== this.labelsEffectKey()) {
      void this.fetchLabels();
    }

    const prevSuggKey = JSON.stringify([
      prevState.inputValue,
      prevProps.collectionSlug,
      prevProps.fieldName,
      this.tagsFromProps(prevProps),
      prevProps.sourceCollection,
      prevProps.sourceField,
      prevState.showSuggestions,
    ]);
    if (prevSuggKey !== this.suggestionsEffectKey()) {
      this.scheduleFetchSuggestions();
    }
  }

  componentWillUnmount(): void {
    document.removeEventListener('mousedown', this.handleClickOutside);
    if (this.suggestTimer) clearTimeout(this.suggestTimer);
  }

  private handleClickOutside = (event: MouseEvent): void => {
    if (this.containerRef.current && !this.containerRef.current.contains(event.target as Node)) {
      this.setState({ showSuggestions: false });
    }
  };

  private scheduleFetchSuggestions(): void {
    if (this.suggestTimer) clearTimeout(this.suggestTimer);
    this.suggestTimer = setTimeout(() => { void this.fetchSuggestions(); }, 300);
  }

  private fetchLabels = async (): Promise<void> => {
    await TagFieldDataService.fetchLabels({
      props: this.props,
      tags: this.getTags(),
      labels: this.state.labels,
      sourceUnavailableMessage: this.state.sourceUnavailableMessage,
      setSourceUnavailable: (message) => this.setState({ sourceUnavailableMessage: message }),
      mergeLabels: (labels) => this.setState((prev) => ({ labels: { ...prev.labels, ...labels } })),
    });
  };

  private fetchSuggestions = async (): Promise<void> => {
    await TagFieldDataService.fetchSuggestions({
      props: this.props,
      inputValue: this.state.inputValue,
      sourceUnavailableMessage: this.state.sourceUnavailableMessage,
      tags: this.getTags(),
      setSuggestions: (suggestions) => this.setState({ suggestions }),
      setSourceUnavailable: (message) => this.setState({ sourceUnavailableMessage: message }),
      setSourceUnavailableWithSuggestions: (message) => this.setState({ sourceUnavailableMessage: message, suggestions: [] }),
      mergeLabels: (labels) => this.setState((prev) => ({ labels: { ...prev.labels, ...labels } })),
    });
  };

  private addTag = (tag: any): void => {
    const { onChange, hasMany = true } = this.props;
    const tags = this.getTags();
    if (tag === null || tag === undefined) return;
    const strValue = String(tag).trim();
    if (!strValue) return;

    if (hasMany && tags.includes(strValue)) {
      this.setState({ inputValue: '', showSuggestions: false });
      return;
    }

    if (hasMany) {
      onChange([...tags, strValue]);
    } else {
      onChange(strValue);
    }

    this.setState({ inputValue: '', showSuggestions: false });

    void TagFieldDataService.autoCreate(this.props, strValue);
  };

  private handleAddClick = (tag: any): void => {
    // Direct synchronous call to ensure state transitions happen immediately
    this.addTag(tag);
  };

  render(): React.ReactNode {
    const {
      placeholder,
      suggestionsLabel,
      theme = 'light',
      fieldName,
      sourceCollection,
      hasMany = true,
      allowCreate = true,
      size = 'md',
      onChange,
    } = this.props;
    const { inputValue, suggestions, showSuggestions, sourceUnavailableMessage, labels, isCreating } = this.state;
    const tags = this.getTags();
    const inferredFieldLabel = TagFieldUtils.inferFieldLabel(fieldName);
    const effectivePlaceholder = placeholder || (sourceCollection ? `Search ${inferredFieldLabel}...` : `Add ${inferredFieldLabel} and press Enter...`);
    const effectiveSuggestionsLabel = suggestionsLabel || `Existing ${inferredFieldLabel}`;

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
        onInputChange={(value) => this.setState({ inputValue: value, showSuggestions: true })}
        onShowSuggestions={() => this.setState({ showSuggestions: true })}
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
