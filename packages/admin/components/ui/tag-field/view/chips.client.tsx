import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { UiFieldUtils } from '@/lib/ui';

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
      theme,
      size,
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
    const inputTextSizeClass = size === FieldSize.SM ? 'text-[12px]' : size === FieldSize.LG ? 'text-sm' : 'text-[13px]';
    const wrapperClasses = hasMany
      ? UiFieldUtils.getFieldClasses(size, 'flex flex-wrap gap-2', true)
      : UiFieldUtils.getFieldClasses(size, 'flex items-center gap-2', false);

    return (
      <div className={wrapperClasses}>
        {tags.map((tag: string, i: number) => {
          const label = labels[tag] || tag;

          return (
            <span
              key={tag}
              className="group bg-indigo-600 text-white px-2 py-0.5 rounded-lg flex items-center gap-1.5 shadow-md shadow-indigo-600/10 active:scale-95 transition-all"
            >
              <div className="flex flex-col leading-tight">
                 <span className="text-[11px] font-semibold leading-none mb-0">{label}</span>
                 {!sourceCollection && label !== tag && <span className="text-[9px] font-medium opacity-70 leading-none mt-0.5">{tag}</span>}
              </div>
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
                className="text-indigo-200 hover:text-white transition-colors p-0"
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
                className={`w-full bg-transparent outline-none ${inputTextSizeClass} font-semibold ${
                    theme === ThemeMode.DARK ? 'text-white placeholder:text-slate-600' : 'text-slate-900 placeholder:text-slate-400'
                }`}
                />
            )}
            {isCreating && <FrameworkIcons.Loader size={12} className="animate-spin text-indigo-500" />}
        </div>
      </div>
    );
  }
}
