import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { DatabaseDriverChoice } from '@fromcode119/core/client';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';
import { Input } from '@/components/ui/view/input.client';
import { RadioGroup } from '@/components/ui/view/radio-group.client';
import { Alert } from '@/components/ui/view/alert.client';
import type { ISetupDatabaseOptions } from '@/app/setup/interfaces/setup-database-options.interface';
import type { ISetupDatabaseServer } from '@/app/setup/interfaces/setup-database-server.interface';

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
  /** Non-null when the operator is pointing this at a server they run rather than the bundled one. */
  @prop declare server: ISetupDatabaseServer | null;
  @prop declare onServerChange: (field: keyof ISetupDatabaseServer, value: string) => void;
  @prop declare onUseOwnServer: (useOwn: boolean) => void;


  @bound
  private handleServerField(event: React.ChangeEvent<HTMLInputElement>): void {
    this.onServerChange(event.currentTarget.name as keyof ISetupDatabaseServer, event.currentTarget.value);
  }

  @bound
  private handleLocation(value: string): void { this.onUseOwnServer(value === 'own'); }

  /** The driver currently chosen, as the server described it. */
  private get selected() {
    return this.options.drivers.find((driver) => driver.value === this.driver);
  }

  private text(key: string): string {
    return AdminDictionary.translate(this.locale, key);
  }

  /** What this deployment will actually provision, for the driver currently selected. */
  private get summary(): ReactNode {
    const { bundled, sqliteFile, connectionFile } = this.options;

    if (this.driver === DatabaseDriverChoice.SQLITE.value) {
      return (
        <div>
          <SetupDatabaseFact label={this.text('setup.database.factFile')} value={sqliteFile} />
          <SetupDatabaseFact label={this.text('setup.database.factCredentials')} value={connectionFile} />
        </div>
      );
    }

    if (!bundled) return null;

    return (
      <div>
        <SetupDatabaseFact label={this.text('setup.database.factServer')} value={`${bundled.host}:${bundled.port}`} />
        <SetupDatabaseFact label={this.text('setup.database.factDatabase')} value={bundled.database} />
        <SetupDatabaseFact label={this.text('setup.database.factRoles')} value={`${bundled.ownerRole}, ${bundled.runtimeRole}`} />
        <SetupDatabaseFact label={this.text('setup.database.factCredentials')} value={connectionFile} />
      </div>
    );
  }

  /**
   * The details of a server the operator runs.
   *
   * TWO ROLES ARE ASKED FOR, not one, wherever the driver isolates tenants. Serving requests as the
   * role that owns the tables turns row-level security off without any error — so the second field
   * set is required rather than advanced, and says why on screen instead of in a tooltip.
   *
   * Nothing here is created: these roles exist on that server already, because this process holds no
   * credential that could make them.
   */
  private get serverForm(): ReactNode {
    const server = this.server!;
    const field = (name: keyof ISetupDatabaseServer, label: string, type = 'text', placeholder = '') => (
      <label className="block">
        <span className="mb-1 block fc-size-xs font-medium fc-tone-muted">{label}</span>
        <Input name={name} type={type} value={server[name]} onChange={this.handleServerField} placeholder={placeholder} />
      </label>
    );

    return (
      <div className="space-y-3 rounded-md border fc-tone-line px-3 py-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">{field('host', this.text('setup.database.fieldHost'), 'text', 'db.example.com')}</div>
          {field('port', this.text('setup.database.fieldPort'), 'text', String(this.selected?.defaultPort ?? ''))}
        </div>
        {field('database', this.text('setup.database.fieldDatabase'))}

        <div className="grid grid-cols-2 gap-2">
          {field('user', this.text('setup.database.fieldUser'))}
          {field('password', this.text('setup.database.fieldPassword'), 'password')}
        </div>

        {this.selected?.needsOwnerRole && (
          <>
            <p className="fc-size-xs leading-relaxed fc-tone-muted">
              {this.text('setup.database.ownerRoleHelp')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {field('ownerUser', this.text('setup.database.fieldOwnerUser'))}
              {field('ownerPassword', this.text('setup.database.fieldOwnerPassword'), 'password')}
            </div>
          </>
        )}
      </div>
    );
  }

  render(): ReactNode {
    return (
      <div className="space-y-4">
        <p className="fc-size-xs fc-tone-muted font-medium leading-relaxed">
          {this.text('setup.database.help')}
        </p>

        <RadioGroup
          boxed
          label={this.text('setup.database.title')}
          value={this.driver}
          onChange={this.onDriverChange}
          options={this.options.drivers.map((driver) => ({
            value: driver.value,
            disabled: !driver.isAvailable,
            label: (
              <>
                {this.text(`setup.database.drivers.${driver.value}.name`)}
                <span className="fc-size-xs fc-tone-faint">
                  {' · '}
                  {driver.isAvailable
                    ? this.text(driver.isSingleSiteOnly ? 'setup.database.singleSite' : 'setup.database.multiSite')
                    : this.text('setup.database.unavailable')}
                </span>
              </>
            ),
            description: this.text(`setup.database.drivers.${driver.value}.note`),
          }))}
        />

        {/*
          * Where it lives. Offered only when there is a choice to make: a driver this deployment
          * ships no server for has exactly one route, so presenting two would be a false choice.
          */}
        {this.selected?.hasBundledServer && (
          <RadioGroup
            value={this.server ? 'own' : 'bundled'}
            onChange={this.handleLocation}
            options={[
              { value: 'bundled', label: this.text('setup.database.useBundled') },
              { value: 'own', label: this.text('setup.database.useOwn') },
            ]}
          />
        )}

        {this.server ? this.serverForm : (
          /*
           * What is about to happen, before it happens. The roles named here do not exist yet — they
           * are created on the next boot — so this is a statement of intent the operator can check
           * against, not a report of something already done.
           */
          <div className="rounded-md border fc-tone-line px-3 py-2.5">
            <p className="mb-1 fc-size-xs font-medium fc-tone-faint">
              {this.text('setup.database.summaryTitle')}
            </p>
            {this.summary}
          </div>
        )}

        <Alert tone="warning">{this.text('setup.database.restartWarning')}</Alert>
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
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-0.5 fc-size-xs">
        <span className="fc-tone-muted">{this.label}</span>
        <span className="font-mono fc-tone-text break-all">{this.value}</span>
      </div>
    );
  }
}
