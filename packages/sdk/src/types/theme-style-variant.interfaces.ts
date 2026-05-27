export interface ThemeStyleVariant {
  label: string;
  colorScheme?: string;
  headingFont?: string;
  imageWidthMd?: string;
  imageHeightMd?: string;
  sectionBgDark?: string;
  sectionBgLight?: string;
  collectionRenderer?: string;
  [key: string]: unknown;
}
