/**
 * Settings → Appearance: how the console itself looks. Part of `SystemConstants.META_KEY` — spread into
 * `SystemMetaKeys.ALL` — and split out for size.
 */
export class AdminLookMetaKeys {
  static readonly ALL = {
    ADMIN_APPEARANCE: 'admin_appearance',
    /** Whether admin surfaces render elevated (shadows) or flat. Absent = elevated. */
    ADMIN_SHADOWS: 'admin_shadows',
    /**
     * Whether a section's pages stand in a SECOND column beside the menu, or under their line inside
     * the one menu. Absent = one menu.
     *
     * It is a width decision, not a taste one: the second column costs 220px of every screen, and a
     * record page needs 896px before its side column fits beside the form. At 1280 with both columns
     * the record gets 767px, so the side column never fits and every card falls into one tall stack.
     */
    ADMIN_NAV_COLUMN: 'admin_nav_column',
  } as const;
}
