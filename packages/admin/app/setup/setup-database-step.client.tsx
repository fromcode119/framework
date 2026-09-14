import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { DatabaseDriverChoice } from '@fromcode119/core/client';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';
import type { ISetupDatabaseOptions } from '@/app/setup/setup-database-options.interface';

/**
 * The step before every other one: which database this installation will use.
 *
 * It is asked first because nothing else can be asked without it — there is no account to create and
 * no setting to write until something can store them — and it is the only answer here that cannot be
 * changed later from Settings. Picking a driver with no row-level security means this installation
 * can never host a second site, so that consequence is printed next to the option rather than
 * discovered months later when adding one refuses to boot.
 *
 * EVERY VALUE ON SCREEN COMES FROM THE SERVER. The host, port, database name, the two role names and
 * the path the credentials are written to are what the deployment declared and what will actually be
 * provisioned; none of it is typed here and none of it is a placeholder. The passwords are generated
 * and deliberately never shown — nothing needs to type them again.
 */
export class SetupDatabaseStep extends PureReactor {
  @prop declare locale: string;
  @prop declare options: ISetupDatabaseOptions;
  @prop declare driver: string;
  @prop declare onDriverChange: (driver: string) => void;

  @bound
  private handleClick(event: React.MouseEvent<HTMLButtonElement>): void {
    this.onDriverChange(event.currentTarget.value);
  }

  private text(key: string): string {
    return AdminDictionary.translate(this.locale, key);
  }

  private optionClass(value: string, isAvailable: boolean): string {
    if (!isAvailable) {
      return 'w-full p-4 rounded-xl border text-left border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed';
    }
    const selected = value === this.driver;
    return [
      'w-full p-4 rounded-xl border text-left transition-colors',
      selected
        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
        : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300',
    ].join(' ');
  }

  /** What this deployment will actually provision, for the driver currently selected. */
  private get summary(): ReactNode {
    const { bundled, sqliteFile, connectionFile } = this.options;

    if (this.driver === DatabaseDriverChoice.SQLITE.value) {
      return (
        <dl className="space-y-1.5">
          <SetupDatabaseFact label={this.text('setup.database.factFile')} value={sqliteFile} />
          <SetupDatabaseFact label={this.text('setup.database.factCredentials')} value={connectionFile} />
        </dl>
      );
    }

    if (!bundled) return null;

    return (
      <dl className="space-y-1.5">
        <SetupDatabaseFact label={this.text('setup.database.factServer')} value={`${bundled.host}:${bundled.port}`} />
        <SetupDatabaseFact label={this.text('setup.database.factDatabase')} value={bundled.database} />
        <SetupDatabaseFact label={this.text('setup.database.factRoles')} value={`${bundled.ownerRole}, ${bundled.runtimeRole}`} />
        <SetupDatabaseFact label={this.text('setup.database.factCredentials')} value={connectionFile} />
      </dl>
    );
  }

  render(): ReactNode {
    return (
      <div className="space-y-4">
        <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
          {this.text('setup.database.help')}
        </p>

        <div className="space-y-2">
          {this.options.drivers.map((driver) => (
            <button
              key={driver.value}
              type="button"
              value={driver.value}
              disabled={!driver.isAvailable}
              onClick={this.handleClick}
              className={this.optionClass(driver.value, driver.isAvailable)}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {this.text(`setup.database.drivers.${driver.value}.name`)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {driver.isAvailable
                    ? this.text(driver.isSingleSiteOnly ? 'setup.database.singleSite' : 'setup.database.multiSite')
                    : this.text('setup.database.unavailable')}
                </span>
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
                {this.text(`setup.database.drivers.${driver.value}.note`)}
              </span>
            </button>
          ))}
        </div>

        {/*
          * What is about to happen, before it happens. The roles named here do not exist yet — they
          * are created on the next boot — so this is a statement of intent the operator can check
          * against, not a report of something already done.
          */}
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {this.text('setup.database.summaryTitle')}
          </p>
          {this.summary}
        </div>

        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-500/40 dark:bg-amber-500/10">
          <p className="text-[12px] leading-relaxed text-amber-900 dark:text-amber-200">
            {this.text('setup.database.restartWarning')}
          </p>
        </div>
      </div>
    );
  }
}

/** One labelled fact about what will be provisioned. Monospaced because every value is an identifier. */
class SetupDatabaseFact extends PureReactor {
  @prop declare label: string;
  @prop declare value: string;

  render(): ReactNode {
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <dt className="text-[11px] text-slate-500">{this.label}</dt>
        <dd className="font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all">{this.value}</dd>
      </div>
    );
  }
}
