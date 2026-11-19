import { InlineTip } from '@/components/ui/view/inline-tip.client';
import { Text } from '@/components/ui/view/text.client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Every version between this installation and the newest one, with what each changed.
 *
 * "Install v0.2.16" asked an operator to agree to a number. Being one release behind is a different
 * decision from being five, and the reason to take a release is in what it says it fixed.
 *
 * The text is that version's section of the project's CHANGELOG.md (or, failing that, its release
 * commit's message), as plain text. A release that said nothing in either place shows nothing — there is
 * no generated summary and no stand-in sentence, because an invented changelog is worse than an absent
 * one: it is a claim about code that nobody made.
 */
export class PendingReleaseList extends PureReactor {
  @prop declare releases: Array<{ version: string; notes: string }>;

  render(): ReactNode {
    if (!this.releases?.length) return null;

    return (
      <div className="fc-stack">
        <Text size="xsmall" muted>
          {this.releases.length === 1
            ? AdminI18n.t('settings.updates.releasesSinceOne')
            : AdminI18n.t('settings.updates.releasesSinceMany', { count: this.releases.length })}
        </Text>
        {this.releases.map((release) => (
          <InlineTip key={release.version} label={`v${release.version}`}>
            {release.notes ? <span className="fc-pre-line">{release.notes}</span> : AdminI18n.t('settings.updates.noNotesWereWrittenFor')}
          </InlineTip>
        ))}
      </div>
    );
  }
}
