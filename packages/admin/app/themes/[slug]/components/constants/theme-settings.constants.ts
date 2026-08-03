export class ThemeSettingsConstants {
  static readonly CORE_LAYOUTS = [
    { id: 'core/layouts/Default', label: 'Default Page', description: 'Used for standard content pages.' },
    { id: 'core/layouts/Blank', label: 'Blank Canvas', description: 'Minimal layout without header or footer.' },
    { id: 'core/layouts/Home', label: 'Homepage', description: 'Specific layout for the front page.' },
    { id: 'core/layouts/auth', label: 'Authentication', description: 'Layout for login and register screens.' }
  ];

  static readonly GOOGLE_FONTS = [
    { label: 'Inter', value: 'Inter, sans-serif' },
    { label: 'Roboto', value: 'Roboto, sans-serif' },
    { label: 'Playfair Display', value: '"Playfair Display", serif' },
    { label: 'Lora', value: 'Lora, serif' },
    { label: 'Manrope', value: 'Manrope, sans-serif' },
    { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'System sans', value: 'system-ui, -apple-system, sans-serif' }
  ];
}
