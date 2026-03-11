/**
 * Matte mono utility classes used across the assistant UI.
 */
export class GlassMorphism {
  static readonly GLASS_FONT_IMPORT =
    "@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');";

  static readonly GLASS_APP_BG = `
  relative min-h-screen overflow-hidden
  [--bg:#ffffff]
  [--surface:rgba(0,0,0,0.04)]
  [--surface-strong:rgba(0,0,0,0.07)]
  [--border:rgba(0,0,0,0.08)]
  [--text-main:#09090b]
  [--text-sub:#71717a]
  [--accent:#09090b]
  [--input-bg:#f4f4f5]
  [--sidebar-bg:#fafafa]
  [--code-bg:#f1f1f1]
  bg-[var(--bg)] text-[var(--text-main)]
  dark:[--bg:#0d0d0d]
  dark:[--surface:rgba(255,255,255,0.03)]
  dark:[--surface-strong:rgba(255,255,255,0.06)]
  dark:[--border:rgba(255,255,255,0.08)]
  dark:[--text-main:#ffffff]
  dark:[--text-sub:#a1a1aa]
  dark:[--accent:#ffffff]
  dark:[--input-bg:rgba(255,255,255,0.02)]
  dark:[--sidebar-bg:#0d0d0d]
  dark:[--code-bg:#1a1a1a]
`;

  static readonly GLASS_CARD = `
  rounded-2xl border border-[var(--border)]
  bg-[var(--surface)] backdrop-blur-lg
  shadow-[0_10px_30px_rgba(0,0,0,0.08)]
  dark:shadow-[0_14px_34px_rgba(0,0,0,0.35)]
`;

  static readonly GLASS_FLOAT_CHROME = `
  rounded-xl border border-[var(--border)]
  bg-[var(--surface)] backdrop-blur-lg
  shadow-[0_8px_24px_rgba(0,0,0,0.07)]
  dark:shadow-[0_10px_26px_rgba(0,0,0,0.35)]
`;

  static readonly GLASS_PANEL = `
  rounded-xl border border-[var(--border)]
  bg-[var(--surface)] p-4 backdrop-blur-md
`;

  static readonly GLASS_SUB_PANEL = `
  rounded-lg border border-[var(--border)]
  bg-[color-mix(in_oklab,var(--surface)_85%,transparent)]
  backdrop-blur-sm
`;

  static readonly GLASS_MESSAGE_ASSISTANT = `
  border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)]
  shadow-[0_4px_14px_rgba(0,0,0,0.05)]
`;

  static readonly GLASS_MESSAGE_USER = `
  border border-[var(--text-main)] bg-[var(--text-main)] text-[var(--bg)]
  shadow-[0_10px_22px_rgba(0,0,0,0.2)]
`;

  static readonly GLASS_MESSAGE_SYSTEM = `
  border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-strong)_88%,transparent)] text-[var(--text-sub)]
`;

  static readonly GLASS_INPUT = `
  rounded-xl border border-[var(--border)]
  bg-[var(--input-bg)] px-3 py-2 text-[var(--text-main)]
  placeholder-[var(--text-sub)] backdrop-blur-sm
  transition-all duration-200
  focus:border-[color-mix(in_oklab,var(--text-main)_26%,var(--border))]
  focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--text-main)_12%,transparent)]
`;

  static readonly GLASS_BUTTON = `
  inline-flex items-center justify-center rounded-xl
  border border-[var(--border)] px-4 py-2 font-medium
  bg-[var(--surface)] text-[var(--text-main)]
  shadow-[0_6px_16px_rgba(0,0,0,0.08)]
  transition-all duration-200
  hover:bg-[var(--surface-strong)] hover:translate-y-[-1px]
  hover:shadow-[0_10px_22px_rgba(0,0,0,0.12)]
  disabled:cursor-not-allowed disabled:opacity-50
`;

  static readonly GLASS_BUTTON_PRIMARY = `
  inline-flex items-center justify-center rounded-xl
  border border-[var(--text-main)] px-4 py-2 font-semibold
  bg-[var(--text-main)] text-[var(--bg)]
  shadow-[0_10px_22px_rgba(0,0,0,0.22)]
  transition-all duration-200
  hover:translate-y-[-1px] hover:opacity-95
  disabled:cursor-not-allowed disabled:opacity-50
`;

  static readonly GLASS_ICON_BUTTON = `
  inline-flex h-9 w-9 items-center justify-center rounded-xl border
  border-[var(--border)] bg-[var(--surface)] text-[var(--text-sub)] backdrop-blur-sm
  shadow-[0_6px_16px_rgba(0,0,0,0.08)]
  transition-all duration-200
  hover:translate-y-[-1px] hover:bg-[var(--surface-strong)] hover:text-[var(--text-main)]
`;

  static readonly GLASS_BADGE = `
  inline-flex items-center rounded-full border border-[var(--border)]
  bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-sub)]
`;

  static readonly GLASS_GRADIENT_TEXT = `
  text-[var(--text-main)]
`;

  static readonly GLASS_PROGRESS_BAR = `
  h-1 overflow-hidden rounded-full
  bg-[var(--surface-strong)]
  transition-all duration-500
`;

  static readonly GLASS_PROGRESS_ACTIVE = `
  h-full w-full animate-pulse bg-[var(--text-main)]
`;
}

