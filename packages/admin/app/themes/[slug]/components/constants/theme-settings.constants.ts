import { AdminI18n } from '@/lib/i18n/admin-i18n';
export class ThemeSettingsConstants {
  static get GOOGLE_FONTS() {
    return [
    { label: 'Inter', value: 'Inter, sans-serif' },
    { label: 'Roboto', value: 'Roboto, sans-serif' },
    { label: 'Playfair Display', value: '"Playfair Display", serif' },
    { label: 'Lora', value: 'Lora, serif' },
    { label: 'Manrope', value: 'Manrope, sans-serif' },
    { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: AdminI18n.t('themes.systemSans'), value: 'system-ui, -apple-system, sans-serif' }
  ];
  }
}
