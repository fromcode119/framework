import { FieldSize } from '@/components/ui/enums/field-size.enum';

/**
 * Shared UI styling constants and utilities for consistent design across the framework.
 */
export class UiFieldUtils {
  static readonly COMMON = {
    // ONE radius token for every control, and it is the CONSOLE's, not the site's. This read
    // `--radius`, which BrandTokenStyleService replaces at runtime with the active brand's radius —
    // so the console's controls changed corner with whichever site happened to be open. Anything that
    // needs a different corner changes `--fc-control-radius`, not a Tailwind step beside it.
    radius: 'rounded-[var(--fc-control-radius)]',
    radiusInner: 'rounded-md',
    transition: 'transition-all duration-200',
    shadow: 'shadow-sm',
    shadowHover: 'shadow-md',
    shadowFocus: 'ring-4 ring-indigo-500/10',
  };

  /* The height comes from the token, never from a Tailwind step beside it: `h-10` here and
     `--fc-field-h` there is how the two drift apart the moment one of them is changed. */
  private static readonly ONE_SIZE_LAYOUT = 'py-1.5 px-3 h-[var(--fc-field-h)] leading-none';
  private static readonly ONE_SIZE_CONTAINER = 'min-h-[var(--fc-field-h)] py-1.5 px-3 leading-none';

  static readonly FIELD = {
    /* A field is drawn by ONE class in admin.css — corner, ink, edge, the colour it fills with and
       what focus does to it. What stood here was a white box with a flat border that turned indigo on
       hover, a brand radius that changed with whichever site was open, and a 4px indigo halo on focus:
       three decisions a stylesheet cannot see and no appearance can switch off. */
    base: 'w-full box-border appearance-none outline-none fc-field',
    light: '',
    dark: '',
    /**
     * ONE size. Every text field, select, number field and date field in the console is the same
     * height with the same text, whatever `size` a caller asks for: three sizes meant a row could hold
     * a 34px field beside a 40px one, and each screen picked its own. The keys stay so `FieldSize`
     * (which buttons also use, and do vary by) still resolves here.
     */
    sizes: {
      sm: { layout: UiFieldUtils.ONE_SIZE_LAYOUT, container: UiFieldUtils.ONE_SIZE_CONTAINER },
      md: { layout: UiFieldUtils.ONE_SIZE_LAYOUT, container: UiFieldUtils.ONE_SIZE_CONTAINER },
      lg: { layout: UiFieldUtils.ONE_SIZE_LAYOUT, container: UiFieldUtils.ONE_SIZE_CONTAINER },
    }
  };

  static readonly TEXT = {
    /* A label reads like everything else that carries words — 13/20, in the record's own ink, not a
       12px grey caption. Grey-and-small is what made a form look like the small print of a form. */
    LABEL: 'fc-field-label',
    ERROR: 'text-[12px] font-medium text-rose-500 mt-1 ms-0.5',
    SUBTEXT: 'text-[12px] font-medium text-slate-400 mt-1 ms-0.5 leading-relaxed',
    /**
     * Provenance line under an EMPTY field: what the site uses instead, and who decided it. Amber
     * rather than the neutral subtext grey because "something you did not set is being published" is a
     * state the operator must notice, but it is not an error — the value is legitimately configured,
     * just somewhere else.
     */
    PROVENANCE: 'text-[12px] font-medium text-amber-600/90 mt-1 ms-0.5 leading-relaxed',
    PROVENANCE_VALUE: 'font-medium tabular-nums',
    PROVENANCE_LINK: 'underline underline-offset-2 hover:text-amber-700',
    /** Empty field that resolves to nothing at all — informational, so it stays in the quiet grey. */
    PROVENANCE_NONE: 'text-[12px] font-medium text-slate-400 mt-1 ms-0.5 leading-relaxed'
  };

  /** True for a class that would give a single-line field its own height or text size. */
  private static resizesALine(token: string): boolean {
    const name = token.replace(/^([a-z-]+:)+/, '').replace(/^!/, '');
    if (/^text-(xs|sm|base|lg|xl|\d+xl|\[\d[^\]]*\])$/.test(name)) return true;
    const step = name.match(/^h-(\d+(?:\.\d+)?)$/);
    if (step) return Number(step[1]) <= 14;
    const px = name.match(/^h-\[(\d+(?:\.\d+)?)(px|rem)\]$/);
    return px ? (px[2] === 'px' ? Number(px[1]) <= 56 : Number(px[1]) <= 3.5) : false;
  }

  static getFieldClasses(size: FieldSize = FieldSize.MD, extra: string = '', isContainer: boolean = false): string {
    const sizes = UiFieldUtils.FIELD.sizes as Record<string, { layout: string; container: string }>;
    const sizeConfig = sizes[size.value] ?? sizes.md;
    const sizeClasses = isContainer ? sizeConfig.container : sizeConfig.layout;

    if (!extra) {
      return `${UiFieldUtils.FIELD.base} ${UiFieldUtils.FIELD.light} ${UiFieldUtils.FIELD.dark} ${sizeClasses}`;
    }

    // A caller may add to a field, never resize it: a height or text size of its own is dropped, so the
    // one size above holds on every screen. A tall box (a text area's `min-h`, an editor's `h-64`) is
    // not a line of text and keeps its height.
    extra = extra.split(/\s+/).filter((token) => !UiFieldUtils.resizesALine(token)).join(' ');
    const hasHeight = extra.split(/\s+/).some((token) => /^h-/.test(token));
    const hasPaddingY = extra.includes('py-') || extra.includes('pt-') || extra.includes('pb-');
    const hasPaddingX = extra.includes('px-');
    const hasPaddingLeft = extra.includes('pl-');
    const hasPaddingRight = extra.includes('pr-');
    const hasTextSize = false;
    const hasRounded = extra.includes('rounded-');

    const finalSizeClasses = sizeClasses.split(' ').filter((cls) => {
      if (hasHeight && cls.startsWith('h-')) return false;
      if (hasPaddingY && (cls.startsWith('py-') || cls.startsWith('pt-') || cls.startsWith('pb-'))) return false;
      if (hasPaddingX && (cls.startsWith('px-') || cls.startsWith('pl-') || cls.startsWith('pr-'))) return false;
      if (hasPaddingLeft && cls.startsWith('pl-')) return false;
      if (hasPaddingRight && cls.startsWith('pr-')) return false;
      if (hasTextSize && cls.startsWith('text-')) return false;
      return true;
    }).join(' ');

    const baseClasses = hasRounded
      ? UiFieldUtils.FIELD.base.split(' ').filter((cls) => !cls.startsWith('rounded')).join(' ')
      : UiFieldUtils.FIELD.base;

    return `${baseClasses} ${UiFieldUtils.FIELD.light} ${UiFieldUtils.FIELD.dark} ${finalSizeClasses} ${extra}`.replace(/\s+/g, ' ').trim();
  }
}
