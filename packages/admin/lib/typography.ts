/**
 * Typography Design Tokens for Admin UI
 * Ensures accessibility compliance (minimum 12px) and consistent scale.
 */
export class AdminTypography {
  static readonly TYPOGRAPHY = {
    // Font sizes
    XS: 'text-xs',      // 12px
    SM: 'text-sm',      // 14px
    BASE: 'text-base',  // 16px
    LG: 'text-lg',      // 18px
    XL: 'text-xl',      // 20px
    '2XL': 'text-2xl',  // 24px
    '3XL': 'text-3xl',  // 30px
    '4XL': 'text-4xl',  // 36px

    // Common UI patterns
    LABEL: 'text-[12px] font-medium text-slate-500/80 tracking-wide',
    SUBTEXT: 'text-[12px] font-medium text-slate-400 leading-relaxed',
    DETAIL: 'text-xs font-medium leading-relaxed',
    NAV: 'text-xs font-medium',

    // Headings (admin UI)
    HEADING: {
      SUBTLE: 'text-lg font-medium tracking-tight',
    },
  };

  static readonly UI_TEXT = {
    LABEL: 'text-[12px] font-medium text-slate-500/80 tracking-wide',
    CAPTION: 'text-xs font-medium',
    BODY: 'text-sm font-medium leading-relaxed',
    H1: 'text-2xl font-medium tracking-tight',
    H2: 'text-xl font-medium tracking-tight',
    H3: 'text-lg font-medium tracking-tight',
  };
}
