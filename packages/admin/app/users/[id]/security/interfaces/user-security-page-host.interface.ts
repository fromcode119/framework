import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';
import type { IUserSecurityPageClientState } from '@/app/users/[id]/security/interfaces/user-security-page-client-state.interface';

/** What {@link UserSecurityPageActions} needs from the page-client to drive it, hook-free. */
export interface IUserSecurityPageHost {
  /** True between `componentDidMount` and `componentWillUnmount`. */
  readonly mounted: boolean;
  /**
   * The state the actions actually read, named member by member — NOT a `state` bag: the page keeps its
   * values in `@state` fields, and re-declaring React's `state` property with a narrower type is an
   * illegal override (TS2416/TS2420).
   */
  readonly generatedRecoveryCodes: string[];
  readonly tokenName: string;
  readonly tokenDays: string;
  readonly verificationCode: string;
  /** Raw `setState` pass-through — deliberately UNGUARDED; callers keep the `mounted` check explicit. */
  patch(patch: Partial<IUserSecurityPageClientState>): void;
  patchWith(updater: (state: IUserSecurityPageClientState) => Partial<IUserSecurityPageClientState>): void;
  readonly notify: INotificationContextType;
  /** Route param `[id]` — the user whose security page this is. */
  readonly id: string;
  /** True when the admin is viewing their own security page. */
  readonly isSelf: boolean;
  /** Navigate away (used when the caller revokes its own session). */
  redirectToLogin(): void;
}
