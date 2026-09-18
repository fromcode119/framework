/**
 * Visible failure state for a `Slot` that renders an entire plugin admin page body (the plugin's own
 * page component, or its page/edit/detail slot). Unlike the storefront — where `PluginMountErrorBoundary`
 * renders nothing on catch, because no admin field configures fallback copy for a site visitor — a crash
 * here would otherwise blank the whole admin page with nothing but a console error, leaving the operator
 * no on-screen signal that anything went wrong.
 *
 * Reuses `CustomFieldErrorBoundary`'s own convention exactly (same box, same "Component "X" failed to
 * render." copy) rather than inventing new fallback copy.
 */
export class PluginMountErrorFallback {
  static render(identity: { pluginSlug?: string; componentName?: string }) {
    const name = String(identity.componentName || identity.pluginSlug || 'unknown');

    return (
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 text-xs font-medium tracking-wide flex items-center gap-2">
        <span>{`Component "${name}" failed to render.`}</span>
      </div>
    );
  }
}
