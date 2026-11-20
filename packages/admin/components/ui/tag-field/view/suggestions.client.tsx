import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { ITagOption } from '@/components/ui/tag-field/interfaces/tag-option.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class TagFieldSuggestions extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare inputValue: string;
  @prop declare suggestions: ITagOption[];
  @prop declare showSuggestions: boolean;
  @prop declare sourceUnavailableMessage: string;
  @prop declare sourceCollection?: string;
  @prop declare suggestionsLabel: string;
  @prop declare createEntityLabel: string;
  @prop declare allowCreate: boolean;
  @prop declare onAdd: (tag: any) => void;

  render(): ReactNode {
    const {
      inputValue,
      suggestions,
      showSuggestions,
      sourceUnavailableMessage,
      sourceCollection,
      suggestionsLabel,
      createEntityLabel,
      allowCreate,
      onAdd,
    } = this;

    if (!(showSuggestions && (inputValue.length > 0 || suggestions.length > 0 || !!sourceUnavailableMessage))) {
      return null;
    }

    // The sheet and the rows every menu in this console uses. It was its own object: a blurred pane,
    // indigo hover, and a "create" row drawn as a tinted card with a 32px indigo tile in it.
    return (
        <div className="fc-menu-sheet fc-tag-menu">
          {sourceUnavailableMessage ? <div className="fc-tag-menu__note">{sourceUnavailableMessage}</div> : null}

          {suggestions.length > 0 ? (
            <>
              <div className="fc-tag-menu__caption">{suggestionsLabel}</div>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.value}
                  type="button"
                  className="fc-menu-action"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onAdd(suggestion.value);
                  }}
                >
                  <span>{suggestion.label}</span>
                  {!sourceCollection && suggestion.label !== suggestion.value ? <span className="fc-tag-menu__value">{suggestion.value}</span> : null}
                </button>
              ))}
            </>
          ) : null}

          {inputValue.length > 0 && !sourceUnavailableMessage && !suggestions.some(s => s.value === inputValue || s.label === inputValue) ? (
            <button
              type="button"
              className="fc-menu-action"
              onMouseDown={(e) => {
                e.preventDefault();
                onAdd(inputValue);
              }}
            >
              <FrameworkIcons.Plus size={15} />
              <span>{AdminI18n.t(allowCreate ? 'ui.tags.create' : 'ui.tags.useCustom', { label: createEntityLabel })}</span>
              <span className="fc-tag-menu__value">"{inputValue}"</span>
            </button>
          ) : null}
        </div>
    );
  }
}
