import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { SystemLocaleOptionsService } from '@/components/collection/fields/system-locale-options-service';
import { ISystemLocaleOption } from '@/components/collection/fields/interfaces/system-locale-option.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { FrameworkIcons } from '@fromcode119/react';

/**
 * Built-in, framework-owned picker for SEVERAL system locales, in a deliberate order.
 *
 * The single-locale {@link SystemLocaleField} answers "which language"; this answers "which languages,
 * and which one leads" — the case a document rendered in more than one language needs, where position 1
 * is the primary and the rest follow it. Order is the operator's, so the value keeps the sequence they
 * picked in rather than the order the locales happen to be configured in.
 *
 * The options come from the platform's configured locales (the same source the Localization settings
 * page writes), so a language that install does not have cannot be chosen here.
 *
 * Stored as a comma-separated list of codes, matching the other ordered multi-pick settings.
 */
export class SystemLocalesField extends Reactor {
  @prop declare value?: any;
  @prop declare onChange?: (value: string) => void;
  @prop declare theme?: ThemeMode;
  @prop declare disabled?: boolean;
  @prop declare field?: any;

  @state options: ISystemLocaleOption[] = [];
  @state loaded = false;

  componentDidMount(): void {
    AdminSystemSettingsClient.getAll()
      .then((settings) => { this.options = SystemLocaleOptionsService.fromSettings(settings); })
      .catch(() => { this.options = SystemLocaleOptionsService.fallback(); })
      .finally(() => { this.loaded = true; });
  }

  /** Accepts the stored CSV or an array, and keeps the operator's order. */
  private get selected(): string[] {
    const raw = this.value;
    const list: string[] = Array.isArray(raw)
      ? raw.map((entry) => String(entry ?? ''))
      : String(raw ?? '').split(',');

    const seen = new Set<string>();
    const codes: string[] = [];
    for (const entry of list) {
      const code = entry.trim().toLowerCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      codes.push(code);
    }
    return codes;
  }

  private get isReadOnly(): boolean {
    return Boolean(this.field?.admin?.readOnly) || Boolean(this.disabled);
  }

  @bound private toggle(code: string): void {
    if (this.isReadOnly) return;
    const selected = this.selected;
    // Appending rather than inserting keeps position 1 stable: re-picking a language must not silently
    // promote it over the one already acting as primary.
    const next = selected.includes(code) ? selected.filter((entry) => entry !== code) : [...selected, code];
    this.onChange?.(next.join(','));
  }

  @bound private moveEarlier(code: string): void {
    if (this.isReadOnly) return;
    const selected = this.selected;
    const index = selected.indexOf(code);
    if (index <= 0) return;
    const next = [...selected];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    this.onChange?.(next.join(','));
  }

  render(): ReactNode {
    const { options, loaded } = this;
    const selected = this.selected;

    if (!loaded) {
      return <div className="fc-size-xs fc-tone-muted py-2">{AdminI18n.t('ui.locales.loading')}</div>;
    }

    return (
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((option) => {
          const position = selected.indexOf(option.value);
          const isSelected = position >= 0;
          return (
            <span key={option.value} className="inline-flex items-center">
              <Checkbox
                checked={isSelected}
                disabled={this.isReadOnly}
                onChange={() => this.toggle(option.value)}
                label={<>{isSelected ? <span className="me-1.5 fc-tone-faint">{position + 1}</span> : null}{option.label}</>}
              />
              {isSelected && position > 0 && !this.isReadOnly && (
                <Button
                  type="button"
                  variant={ButtonVariant.GHOST}
                  className="fc-btn--glyph ms-0.5"
                  onClick={() => this.moveEarlier(option.value)}
                  title={AdminI18n.t('ui.locales.moveEarlier')}
                  aria-label={AdminI18n.t('ui.locales.moveEarlier')}
                >
                  <FrameworkIcons.ArrowUp size={13} />
                </Button>
              )}
            </span>
          );
        })}
        {!options.length && <span className="fc-size-xs fc-tone-muted">{AdminI18n.t('ui.locales.none')}</span>}
      </div>
    );
  }
}
