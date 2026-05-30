export type LayoutTargetKind = 'page' | 'block' | 'slot';

export type LayoutResolutionSource = 'plugin' | 'theme-replacement';

export type LayoutResolutionStatus = 'resolved' | 'disabled' | 'missing';

export type LayoutDiagnosticSeverity = 'error' | 'warning' | 'info';

export type LayoutDiagnosticCode =
  | 'backend-contract-present/frontend-layout-missing'
  | 'duplicate-plugin-layout'
  | 'frontend-layout-present/backend-contract-missing'
  | 'required-route-disabled'
  | 'theme-override-selected'
  | 'theme-replacement-conflict';