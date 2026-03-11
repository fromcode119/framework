export interface FrontendRuntimeMetadata {
  activeTheme: any;
  themeLayouts: Record<string, any>;
  themeVariables: Record<string, string>;
  settings: Record<string, any>;
  menuItems: any[];
  collections: any[];
  plugins: any[];
}
