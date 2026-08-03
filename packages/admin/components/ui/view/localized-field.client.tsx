import type { IResolvedLocaleContext } from '@/components/ui/interfaces/resolved-locale-context.interface';
import { LocaleScope } from '@/components/ui/enums/locale-scope.enum';
import type React from 'react';
import { prop, state, bound } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminServices } from '@/lib/admin-services';

export class LocalizedField extends AdminComponent {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<LocalizedField, 'label' | 'input' | 'localeScope'>;

  @prop declare label: string;
  @prop declare input: (locale: string) => React.ReactNode;
  @prop declare localeScope?: LocaleScope;

  @state private activeLocale: string = this.resolve().defaultLocale;

  private resolve(): IResolvedLocaleContext {
    const settings = this.runtime?.globalSettings ?? {};
    const localization = AdminServices.getInstance().localization;
    const localeRegistry = localization.parseLocaleRegistry(settings);
    const defaultLocale = this.localeScope === LocaleScope.FRONTEND
      ? localization.resolveFrontendLocale(settings, localeRegistry)
      : localization.resolveAdminLocale(settings, localeRegistry);
    return { localeRegistry, defaultLocale };
  }

  private reconcileLocale(): void {
    const { localeRegistry, defaultLocale } = this.resolve();
    if (!localeRegistry.length) {
      if (this.activeLocale !== defaultLocale) this.activeLocale = defaultLocale;
      return;
    }

    if (!localeRegistry.some((item) => item.code === this.activeLocale)) {
      this.activeLocale = defaultLocale;
    }
  }

  componentDidMount(): void {
    // Context is only populated after construction, so reconcile once mounted.
    this.reconcileLocale();
  }

  componentDidUpdate(): void {
    this.reconcileLocale();
  }

  @bound
  private onSelect(event: React.ChangeEvent<HTMLSelectElement>): void {
    this.activeLocale = event.target.value;
  }

  render(): React.ReactNode {
    const { localeRegistry } = this.resolve();
    const activeLocale = this.activeLocale;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">{this.label}</label>
          {localeRegistry.length ? (
            <select
              value={activeLocale}
              onChange={this.onSelect}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              {localeRegistry.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.label} ({locale.code.toUpperCase()})
                </option>
              ))}
            </select>
          ) : null}
        </div>
        {this.input(activeLocale)}
      </div>
    );
  }
}
