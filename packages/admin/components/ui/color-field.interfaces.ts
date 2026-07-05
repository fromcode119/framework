export interface ColorFieldPresetOption {
  name: string;
  hex: string;
}

export interface ColorFieldProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** The field spec — used to decide whether presets emit a NAMED color (badgeColor/colorScheme) or a hex. */
  field?: { admin?: { component?: string; colorNamed?: boolean } };
}

export interface ColorFieldState {
  customOpen: boolean;
  coords: { top: number; left: number };
}
