import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { TagFieldDataService } from '@/components/ui/tag-field/data-service';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Spinner } from '@/components/ui/view/spinner.client';

export class TagFieldChips extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<TagFieldChips, 'theme' | 'size' | 'tags' | 'labels' | 'sourceCollection' | 'hasMany' | 'isCreating' | 'inputValue' | 'effectivePlaceholder' | 'onChange' | 'onInputChange' | 'onShowSuggestions' | 'onAdd'>;

  @prop declare theme: ThemeMode;
  @prop declare size: FieldSize;
  @prop declare tags: string[];
  @prop declare labels: Record<string, string>;
  @prop declare sourceCollection?: string;
  @prop declare hasMany: boolean;
  @prop declare isCreating: boolean;
  @prop declare inputValue: string;
  @prop declare effectivePlaceholder: string;
  @prop declare onChange: (value: string[] | string) => void;
  @prop declare onInputChange: (value: string) => void;
  @prop declare onShowSuggestions: () => void;
  @prop declare onAdd: (tag: any) => void;

  render(): ReactNode {
    const {
      tags,
      labels,
      sourceCollection,
      hasMany,
      isCreating,
      inputValue,
      effectivePlaceholder,
      onChange,
      onInputChange,
      onShowSuggestions,
      onAdd,
    } = this;
    return (
      <div className="fc-chip-input">
        {tags.map((tag: string, i: number) => {
          const rawLabel = labels[tag] || tag;
          // A reference whose record is GONE must not wear the same chip as a real one. It used to,
          // so a product pointing at a deleted category showed a confident indigo chip and read as
          // nonsense data rather than as a broken link.
          const unresolved = TagFieldDataService.isUnresolved(rawLabel);
          const label = unresolved ? TagFieldDataService.describeUnresolved(rawLabel) : rawLabel;
          // The console's one chip, the same as in a chip field; a missing record's is dashed.
          const chipClass = `fc-chip fc-chip--removable${unresolved ? ' fc-chip--missing' : ''}`;

          return (
            <span
              key={tag}
              className={chipClass}
              title={unresolved ? AdminI18n.t('ui.tags.missingRecord', { id: tag }) : undefined}
            >
              <span>{label}</span>
              {!sourceCollection && !unresolved && label !== tag ? <span className="fc-chip__note">{tag}</span> : null}
              <button
                type="button"
                onClick={() => {
                  if (hasMany) {
                    const newTags = [...tags];
                    newTags.splice(i, 1);
                    onChange(newTags);
                  } else {
                    onChange('');
                  }
                }}
                className="fc-chip__remove"
              >
                <FrameworkIcons.Close size={10} strokeWidth={3} />
              </button>
            </span>
          );
        })}
        <div className="flex-1 flex items-center gap-2 min-w-[120px]">
            {(!hasMany && tags.length > 0) ? null : (
                <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                    onInputChange(e.target.value);
                }}
                onFocus={() => onShowSuggestions()}
                placeholder={tags.length === 0 ? effectivePlaceholder : ''}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (inputValue.trim()) onAdd(inputValue);
                    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
                        const newTags = [...tags];
                        newTags.pop();
                        onChange(hasMany ? newTags : '');
                    }
                } }
                className="fc-chip-input__entry w-full"
                />
            )}
            {isCreating && <Spinner small className="fc-spinner--muted" />}
        </div>
      </div>
    );
  }
}
