import type { ComponentType } from 'react';
import { Enum } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { ConversationMode } from '@ai/enums/conversation-mode.enum';
import { PhaseStep } from '@ai/components/phase-step';

/**
 * The assistant's conversation modes as a method-bearing enum — each member owns its picker metadata
 * (icon/label/description) AND its loading sequence, so the mode selector, composer toolbar and loading
 * indicator all derive from one source instead of duplicating inline option tables.
 */
export class AssistantMode extends Enum {
  static readonly CHAT = new AssistantMode(ConversationMode.CHAT, FrameworkIcons.MessageSquare, 'Chat', 'Answer questions and give advice', [
    new PhaseStep('Processing your request...', FrameworkIcons.Activity),
    new PhaseStep('Analyzing context...', FrameworkIcons.Search),
    new PhaseStep('Preparing response...', FrameworkIcons.File),
  ]);

  static readonly BUILD = new AssistantMode(ConversationMode.BUILD, FrameworkIcons.Wrench, 'Build', 'Make changes to my site', [
    new PhaseStep('Analyzing your request...', FrameworkIcons.Search),
    new PhaseStep('Scanning workspace...', FrameworkIcons.Database),
    new PhaseStep('Planning safe changes...', FrameworkIcons.Shield),
    new PhaseStep('Preparing action plan...', FrameworkIcons.File),
  ]);

  static readonly QUICKFIX = new AssistantMode(ConversationMode.QUICKFIX, FrameworkIcons.Zap, 'Quick Fix', 'Apply simple updates immediately', [
    new PhaseStep('Analyzing your request...', FrameworkIcons.Zap),
    new PhaseStep('Selecting tools...', FrameworkIcons.Wrench),
    new PhaseStep('Running diagnostic checks...', FrameworkIcons.Settings),
    new PhaseStep('Preparing response...', FrameworkIcons.Check),
  ]);

  private constructor(
    value: ConversationMode,
    readonly icon: ComponentType<{ size?: number; className?: string }>,
    readonly label: string,
    readonly description: string,
    readonly loadingPhases: readonly PhaseStep[],
  ) {
    super(value.value);
  }

  /** The mode value, typed as the domain union rather than the base `Enum`'s plain string. */
  get mode(): ConversationMode {
    return this.value as unknown as ConversationMode;
  }

  /** The member for a mode value, falling back to CHAT for unknown values. */
  static resolve(value: string): AssistantMode {
    return AssistantMode.fromValue(value) ?? AssistantMode.CHAT;
  }
}
