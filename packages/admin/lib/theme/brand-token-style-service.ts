/**
 * Installs the active frontend theme's semantic CSS variables into the admin document.
 * The theme configuration remains the source of truth; appearances only consume it.
 */
export class BrandTokenStyleService {
  static install(cssVariables: unknown): void {
    if (typeof document === 'undefined' || typeof cssVariables !== 'string' || !cssVariables.trim()) return;
    const id = 'fc-brand-token-contract';
    const existing = document.getElementById(id) ?? document.head.appendChild(document.createElement('style'));
    existing.id = id;
    existing.textContent = BrandTokenStyleService.normalize(cssVariables);
  }

  private static normalize(cssVariables: string): string {
    const fcVariables = cssVariables
      .replace(/--theme-brand:/g, '--fc-brand:')
      .replace(/--theme-brand-contrast:/g, '--fc-brand-contrast:')
      .replace(/--theme-accent:/g, '--fc-accent:')
      .replace(/--theme-surface:/g, '--fc-surface:')
      .replace(/--theme-surface-muted:/g, '--fc-surface-muted:')
      .replace(/--theme-canvas:/g, '--fc-canvas:')
      .replace(/--theme-text:/g, '--fc-text:')
      .replace(/--theme-text-muted:/g, '--fc-text-muted:')
      .replace(/--theme-border:/g, '--fc-border:')
      .replace(/--theme-success:/g, '--fc-success:')
      .replace(/--theme-warning:/g, '--fc-warning:')
      .replace(/--theme-danger:/g, '--fc-danger:')
      .replace(/--theme-radius:/g, '--fc-radius:')
      .replace(/--theme-shadow:/g, '--fc-shadow:')
      .replace(/--theme-font-body:/g, '--fc-font-body:')
      .replace(/--theme-font-display:/g, '--fc-font-display:');
    return `${fcVariables}\n:root {\n  --background: var(--fc-canvas);\n  --foreground: var(--fc-text);\n  --card: var(--fc-surface);\n  --card-foreground: var(--fc-text);\n  --popover: var(--fc-surface);\n  --popover-foreground: var(--fc-text);\n  --primary: var(--fc-brand);\n  --primary-foreground: var(--fc-brand-contrast);\n  --secondary: var(--fc-surface-muted);\n  --secondary-foreground: var(--fc-text);\n  --muted: var(--fc-surface-muted);\n  --muted-foreground: var(--fc-text-muted);\n  --accent: var(--fc-accent);\n  --accent-foreground: var(--fc-text);\n  --destructive: var(--fc-danger);\n  --destructive-foreground: var(--fc-brand-contrast);\n  --border: var(--fc-border);\n  --input: var(--fc-border);\n  --ring: var(--fc-brand);\n  --radius: var(--fc-radius);\n}`;
  }
}
