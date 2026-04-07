/**
 * Shared UI styling constants and utilities for consistent design across the framework.
 */
export class UiFieldUtils {
  static readonly COMMON = {
    radius: 'rounded-lg',
    radiusInner: 'rounded-md',
    transition: 'transition-all duration-200',
    shadow: 'shadow-sm',
    shadowHover: 'shadow-md',
    shadowFocus: 'ring-4 ring-indigo-500/10',
  };

  static readonly FIELD = {
    base: `w-full box-border appearance-none ${UiFieldUtils.COMMON.radius} outline-none border ${UiFieldUtils.COMMON.transition} font-semibold ${UiFieldUtils.COMMON.shadow}`,
    light: 'bg-white border-slate-200 text-slate-900 caret-slate-900 placeholder:text-slate-400 hover:border-indigo-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 autofill:[-webkit-text-fill-color:#0f172a] autofill:shadow-[inset_0_0_0px_1000px_#ffffff]',
    dark: 'dark:bg-slate-900/60 dark:border-slate-800 dark:text-white dark:caret-white dark:placeholder:text-slate-600 dark:hover:border-indigo-500/50 dark:focus:border-indigo-500 dark:focus:ring-0 dark:[color-scheme:dark] dark:autofill:[-webkit-text-fill-color:#ffffff] dark:autofill:caret-white dark:autofill:shadow-[inset_0_0_0px_1000px_rgba(15,23,42,0.96)]',
    sizes: {
      sm: {
        layout: 'py-1.5 px-3 h-9 text-[11px] leading-none',
        container: 'min-h-[36px] py-1.5 px-3 leading-none'
      },
      md: {
        layout: 'py-2 px-3.5 h-10 text-[12px] leading-none',
        container: 'min-h-[40px] py-2 px-3.5 leading-none'
      },
      lg: {
        layout: 'py-2.5 px-4 h-11 text-[13px] leading-none',
        container: 'min-h-[44px] py-2.5 px-4 leading-none'
      }
    }
  };

  static readonly TEXT = {
    LABEL: 'text-[11px] font-semibold text-slate-500/80 mb-0.5 ml-0.5 tracking-wide',
    ERROR: 'text-[11px] font-bold text-rose-500 mt-1 ml-0.5',
    SUBTEXT: 'text-[11px] font-medium text-slate-400 mt-1 ml-0.5 leading-relaxed'
  };

  static getFieldClasses(size: keyof typeof UiFieldUtils.FIELD.sizes = 'md', extra: string = '', isContainer: boolean = false): string {
    const sizeConfig = UiFieldUtils.FIELD.sizes[size];
    const sizeClasses = isContainer ? sizeConfig.container : sizeConfig.layout;

    if (!extra) {
      return `${UiFieldUtils.FIELD.base} ${UiFieldUtils.FIELD.light} ${UiFieldUtils.FIELD.dark} ${sizeClasses}`;
    }

    const hasHeight = extra.includes('h-');
    const hasPaddingY = extra.includes('py-') || extra.includes('pt-') || extra.includes('pb-');
    const hasPaddingX = extra.includes('px-');
    const hasPaddingLeft = extra.includes('pl-');
    const hasPaddingRight = extra.includes('pr-');
    const hasTextSize = extra
      .split(/\s+/)
      .some((token) => /^text-(xs|sm|base|lg|xl|\d+xl|\[[^\]]+\])$/.test(token));
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