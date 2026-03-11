# AI Documentation (Consolidated)

This is the canonical AI package documentation for `@fromcode119/ai`.

It merges and replaces content previously split across:
- `ARCHITECTURE.md`
- `MIGRATION.md`
- `NEW_COMPONENTS_GUIDE.md`
- `UX_IMPROVEMENT_PLAN.md`

## 1. Architecture

The AI package is an optional core extension that can be enabled or disabled without breaking the rest of the platform.

### Design goals
- Optional by default: core platform must run without AI.
- Graceful degradation: missing AI package should not break admin/API/core.
- Runtime toggling: enable/disable with configuration.
- Clean boundaries: avoid hard coupling from core packages to AI.

### Extension model
- Core extension discovery and lifecycle are handled by the extension manager in core.
- AI registers capabilities during extension init.
- Consumers should check extension state/capabilities before AI-specific behavior.

### Integration boundaries
- `admin`: dynamic AI admin extension loading, no hard dependency.
- `api`: AI routes/features only when AI extension is active.
- `core`: no direct hardcoded AI integration in core registries.

## 2. Migration Guide

### What changed
- Before: AI was a hard dependency integrated directly.
- After: AI is an optional extension with runtime activation.

### Operator behavior
- Default: AI enabled.
- Disable: set `AI_ENABLED=false` and restart services.
- Re-enable: set `AI_ENABLED=true` (or unset) and restart.

### Expected behavior when disabled
- Forge AI UI is hidden or unavailable.
- AI-specific API routes are not registered.
- AI settings/integrations are not shown.

### Developer migration notes
- Do not rely on unconditional AI imports from core/admin/api code paths.
- Use extension-state checks and dynamic loading where AI is optional.
- Keep extension-specific registration in extension registries, not generic loaders.

## 3. UX Improvements

### Plan summary
The Forge AI assistant UX update focuses on reducing cognitive load, removing duplicated controls, clarifying action flows, and improving responsiveness.

### Key improvements
- Unified settings drawer for provider/model/key/behavior.
- Simplified user-facing modes:
  - Chat: answer and advise.
  - Build: structured, approval-driven changes.
  - Quick Fix: focused fast updates.
- Dedicated action approval card with selection, preview, and apply actions.
- Cleaner top bar and less repeated status noise.

## 4. New UX Components

Phase 1 introduced these core UI components:
- `ForgeSettingsDrawer.tsx`: centralized AI and behavior settings.
- `ForgeModeSelector.tsx`: simplified mode switcher.
- `ForgeSimpleTopBar.tsx`: cleaner top navigation.
- `ForgeActionCard.tsx`: explicit action approval UI.

Component intent:
- Separate configuration from conversation.
- Make user intent explicit before execution.
- Keep critical action controls obvious and predictable.

## 5. Maintenance Notes

- Keep this file as the single source of truth for AI package documentation.
- If adding major architecture or UX updates, extend this file first.
- Legacy doc files should remain as thin pointers for compatibility only.
