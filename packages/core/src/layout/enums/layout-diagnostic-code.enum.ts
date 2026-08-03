import { Enum } from '@fromcode119/reactor';

/** Specific layout diagnostic conditions the registry reports. */
export class LayoutDiagnosticCode extends Enum {
  static readonly BACKEND_CONTRACT_PRESENT_FRONTEND_LAYOUT_MISSING = new LayoutDiagnosticCode('backend-contract-present/frontend-layout-missing');
  static readonly DUPLICATE_PLUGIN_LAYOUT = new LayoutDiagnosticCode('duplicate-plugin-layout');
  static readonly FRONTEND_LAYOUT_PRESENT_BACKEND_CONTRACT_MISSING = new LayoutDiagnosticCode('frontend-layout-present/backend-contract-missing');

  static readonly REQUIRED_ROUTE_DISABLED = new LayoutDiagnosticCode('required-route-disabled');
  static readonly THEME_OVERRIDE_SELECTED = new LayoutDiagnosticCode('theme-override-selected');
  static readonly THEME_REPLACEMENT_CONFLICT = new LayoutDiagnosticCode('theme-replacement-conflict');

  private constructor(value: string) {
    super(value);
  }
}
