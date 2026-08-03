export * from '@/components/media/view/media-picker.client';
export * from '@/components/ui/view/button.client';
export * from '@/components/ui/view/input.client';
export * from '@/components/ui/view/select.client';
export * from '@/components/ui/view/text-area.client';
export * from '@/components/ui/view/localized-field.client';
export * from '@/components/ui/tag-field/view/index.client';
export * from '@/components/ui/view/loader.client';
export * from '@/components/ui/view/switch.client';
export * from '@/components/ui/view/page-heading.client';
export * from '@/components/ui/view/compact-page-header.client';
export * from '@/components/ui/view/card.client';
export * from '@/components/ui/view/badge.client';
export * from '@/components/ui/view/stat-card.client';
export * from '@/components/ui/view/data-table.client';
export * from '@/components/ui/view/confirm-dialog.client';
export * from '@/components/ui/view/prompt-dialog.client';
export * from '@/components/ui/date-time-picker/view/index.client';
export * from '@/components/ui/view/currency-select.client';
export * from '@/components/ui/view/money-input.client';
export * from '@/components/ui/view/color-picker.client';
export * from '@/components/ui/view/code-editor.client';
export * from '@/components/ui/view/visual-menu-field.client';
export * from '@/components/view/icon.client';
export * from '@/components/view/theme-context.client';
export * from '@/components/view/theme-context-store.client';
export * from '@/components/view/use-theme.client';
export * from '@/components/view/auth-context.client';
export * from '@/components/view/auth-store.client';
export * from '@/components/view/use-auth.client';
export * from '@/components/view/notification-context.client';
export * from '@/components/view/notification-context-store.client';
export * from '@/components/view/use-notification.client';
export * from '@/components/plugin-dashboard';
export * from '@/components/collection/edit/view/edit-page-section-nav.client';
// The full, schema-driven field renderer (relationship, array, date, media, custom admin.component, …).
// Exposed so appearance shells edit records through the SAME renderer as the default admin instead of a
// limited hand-rolled control set (which silently drops most fields).
export * from '@/components/collection/view/field-renderer.client';
export type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';
export type { IFieldRendererProps } from '@/components/collection/interfaces/field-renderer-props.interface';
export type { IFieldLocaleSwitcherProps } from '@/components/collection/interfaces/field-locale-switcher-props.interface';
export type { IFieldRendererHeaderProps } from '@/components/collection/interfaces/field-renderer-header-props.interface';
export type { IFieldControlRendererProps } from '@/components/collection/interfaces/field-control-renderer-props.interface';
export type { IFieldCustomComponentProps } from '@/components/collection/interfaces/field-custom-component-props.interface';
export type { IFieldRendererFooterProps } from '@/components/collection/interfaces/field-renderer-footer-props.interface';
export type { IFieldSelectControlProps } from '@/components/collection/interfaces/field-select-control-props.interface';
export type { IFieldTextInputProps } from '@/components/collection/interfaces/field-text-input-props.interface';
export type { IFieldTextualControlProps } from '@/components/collection/interfaces/field-textual-control-props.interface';
// The platform number stepper + preset color control, exposed so appearance screens use the SAME controls
// as the field renderer (not raw <input type=number> / text) — one look everywhere.
export * from '@/components/ui/number-stepper';
export * from '@/components/ui/view/color-field.client';
// Appearance engine — exposed on the @fromcode119/admin runtime module so externally-loaded
// appearance bundles can import AdminComponent + the registries/keys and register themselves.
// Enums plugin and appearance UI needs in order to pass typed values (size/variant/theme) rather than
// raw strings — a raw string reaches the component as an Enum-typed prop and never matches.
export * from '@/components/ui/enums/field-size.enum';
export * from '@/components/ui/enums/button-variant.enum';
export { ThemeMode } from '@fromcode119/core/client';
export * from '@/components/view/admin-component.client';
export * from '@/lib/appearance/admin-component-keys';
export * from '@/lib/appearance/admin-page-keys';
export * from '@/lib/appearance/admin-appearance-registry';
export * from '@/lib/appearance/admin-shell-registry';
export * from '@/lib/appearance/admin-component-registry';
export * from '@/lib/appearance/admin-page-registry';
export type { IAppearanceShellProps } from '@/lib/appearance/interfaces/appearance-shell-props.interface';
export type { IAdminAppearanceManifest } from '@/lib/appearance/interfaces/admin-appearance-manifest.interface';
export type { IAppearanceSurfaces } from '@/lib/appearance/interfaces/appearance-surfaces.interface';
export * from '@/lib/appearance/appearance-surface-policy';
