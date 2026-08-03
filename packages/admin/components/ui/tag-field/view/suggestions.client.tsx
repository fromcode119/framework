import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import type { ITagOption } from '@/components/ui/tag-field/interfaces/tag-option.interface';

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
      theme,
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

    return (
        <div className={`absolute z-[100] w-full mt-2 rounded-lg border shadow-2xl p-1 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 overflow-hidden ${
          theme === ThemeMode.DARK ? 'bg-[#0f172a] border-slate-800' : 'bg-white/90 border-slate-200/60 backdrop-blur-3xl shadow-slate-200/50'
        }`}>
          {sourceUnavailableMessage && (
            <div className={`px-3.5 py-3 rounded-lg text-[11px] font-semibold ${
              theme === ThemeMode.DARK
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {sourceUnavailableMessage}
            </div>
          )}

          {suggestions.length > 0 && (
            <>
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">{suggestionsLabel}</span>
                    <FrameworkIcons.Search size={10} className="text-slate-400" />
                </div>
                {suggestions.map((suggestion) => (
                    <button
                    key={suggestion.value}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onAdd(suggestion.value);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-[13px] rounded-lg transition-all duration-200 flex items-center justify-between group ${
                        theme === ThemeMode.DARK
                        ? 'hover:bg-slate-800 text-slate-300 hover:text-white'
                        : 'hover:bg-indigo-50 text-slate-600 hover:text-indigo-600'
                    }`}
                    >
                    <div className="flex flex-col leading-tight">
                        <span className="font-semibold">{suggestion.label}</span>
                        {!sourceCollection && suggestion.label !== suggestion.value && (
                           <span className="text-[10px] opacity-50 font-medium tracking-wide">{suggestion.value}</span>
                        )}
                    </div>
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-all scale-0 group-hover:scale-100" />
                    </button>
                ))}
            </>
          )}

          {inputValue.length > 0 && !sourceUnavailableMessage && !suggestions.some(s => s.value === inputValue || s.label === inputValue) && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onAdd(inputValue);
                }}
                className={`w-full text-left px-3.5 py-2 text-[13px] rounded-lg transition-all duration-200 flex items-center gap-3 group mt-1 ${
                    theme === ThemeMode.DARK
                    ? 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <FrameworkIcons.Plus size={16} strokeWidth={3} />
                </div>
                <div className="flex-1">
                    <span className="font-semibold text-[10px] block leading-none">
                      {allowCreate ? `Create ${createEntityLabel}` : `Use Custom ${createEntityLabel}`}
                    </span>
                    <span className="font-semibold text-[13px] block mt-1">"{inputValue}"</span>
                </div>
              </button>
          )}
        </div>
    );
  }
}
