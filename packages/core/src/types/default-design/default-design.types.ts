export type DefaultDesignTargetKind = 'page' | 'block' | 'slot';

export type DefaultDesignResolutionSource = 'plugin-default' | 'theme-replacement';

export type DefaultDesignResolutionStatus = 'resolved' | 'disabled' | 'missing';

export type DefaultDesignDiagnosticSeverity = 'error' | 'warning' | 'info';

export type DefaultDesignDiagnosticCode =
  | 'backend-contract-present/frontend-default-missing'
  | 'duplicate-plugin-default'
  | 'frontend-default-present/backend-contract-missing'
  | 'required-route-disabled'
  | 'theme-override-selected'
  | 'theme-replacement-conflict';