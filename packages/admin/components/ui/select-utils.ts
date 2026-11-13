import type { IOption } from '@/components/ui/interfaces/option.interface';
import type { ISelectOptionGroup } from '@/components/ui/interfaces/select-option-group.interface';

/**
 * Pure helpers for {@link Select}: option-value normalization, search filtering, and
 * grouping/sectioning. Extracted from the component so its class file stays under the
 * size limit; logic is unchanged.
 */
export class SelectUtils {
  /** Resolves an option/value to a stable string for comparison (handles object-shaped values). */
  static normalizeValue(value: any): string {
    return value && typeof value === 'object'
      ? (value.value || value.id || value.slug)
      : String(value);
  }

  static findSelected(options: IOption[], value: string): IOption | undefined {
    const curVal = SelectUtils.normalizeValue(value);
    return options.find(opt => SelectUtils.normalizeValue(opt.value) === curVal);
  }

  static filter(options: IOption[], searchValue: string): IOption[] {
    return options.filter(opt =>
      opt.label.toLowerCase().includes(searchValue.toLowerCase())
    );
  }

  static group(filteredOptions: IOption[]): ISelectOptionGroup[] {
    return filteredOptions.reduce((acc, opt) => {
      const groupName = opt.group || 'Options';
      const existingGroup = acc.find((g) => g.name === groupName);
      if (existingGroup) {
        existingGroup.options.push(opt);
      } else {
        acc.push({ name: groupName, options: [opt] });
      }
      return acc;
    }, [] as ISelectOptionGroup[]);
  }

  static showGroupHeaders(groups: ISelectOptionGroup[]): boolean {
    return groups.length > 1 || (groups.length === 1 && groups[0].name !== 'Options');
  }

  static sections(groupOptions: IOption[]): ISelectOptionGroup[] {
    return groupOptions.reduce((acc, opt) => {
      const sectionName = opt.section || '';
      const existing = acc.find((s) => s.name === sectionName);
      if (existing) {
        existing.options.push(opt);
      } else {
        acc.push({ name: sectionName, options: [opt] });
      }
      return acc;
    }, [] as ISelectOptionGroup[]);
  }

  static showSectionHeaders(sections: ISelectOptionGroup[]): boolean {
    return sections.length > 1 || (sections.length === 1 && sections[0].name !== '');
  }

  /** The trigger's dark/light classes: the part of the trigger that depends only on the theme. */
  static triggerClasses(isDarkTheme: boolean): { trigger: string; emptyLabel: string; chevron: string } {
    return {
      trigger: isDarkTheme
        ? '!bg-slate-900/60 !border-slate-800 !text-white caret-white placeholder:text-slate-600 hover:!border-indigo-500/50 focus:!border-indigo-500 focus:!ring-0 [color-scheme:dark] autofill:[-webkit-text-fill-color:#ffffff] autofill:caret-white autofill:shadow-[inset_0_0_0px_1000px_rgba(15,23,42,0.96)]'
        : '',
      emptyLabel: isDarkTheme ? 'text-slate-500 font-medium' : 'text-slate-400 font-medium',
      chevron: isDarkTheme ? 'text-slate-500' : 'text-slate-400',
    };
  }

}
