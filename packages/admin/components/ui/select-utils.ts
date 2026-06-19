import type { Option, SelectOptionGroup } from './select.interfaces';

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

  static findSelected(options: Option[], value: string): Option | undefined {
    const curVal = SelectUtils.normalizeValue(value);
    return options.find(opt => SelectUtils.normalizeValue(opt.value) === curVal);
  }

  static filter(options: Option[], searchValue: string): Option[] {
    return options.filter(opt =>
      opt.label.toLowerCase().includes(searchValue.toLowerCase())
    );
  }

  static group(filteredOptions: Option[]): SelectOptionGroup[] {
    return filteredOptions.reduce((acc, opt) => {
      const groupName = opt.group || 'Options';
      const existingGroup = acc.find((g) => g.name === groupName);
      if (existingGroup) {
        existingGroup.options.push(opt);
      } else {
        acc.push({ name: groupName, options: [opt] });
      }
      return acc;
    }, [] as SelectOptionGroup[]);
  }

  static showGroupHeaders(groups: SelectOptionGroup[]): boolean {
    return groups.length > 1 || (groups.length === 1 && groups[0].name !== 'Options');
  }

  static sections(groupOptions: Option[]): SelectOptionGroup[] {
    return groupOptions.reduce((acc, opt) => {
      const sectionName = opt.section || '';
      const existing = acc.find((s) => s.name === sectionName);
      if (existing) {
        existing.options.push(opt);
      } else {
        acc.push({ name: sectionName, options: [opt] });
      }
      return acc;
    }, [] as SelectOptionGroup[]);
  }

  static showSectionHeaders(sections: SelectOptionGroup[]): boolean {
    return sections.length > 1 || (sections.length === 1 && sections[0].name !== '');
  }
}
