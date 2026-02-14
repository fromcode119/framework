import * as Lucide from 'lucide-react';

const SYSTEM_ICON_NAMES = [
  'Dashboard',
  'plugins',
  'Users',
  'settings',
  'media',
  'Layout',
  'system',
  'Menu',
  'Search',
  'Sun',
  'Moon',
  'Bell',
  'User',
  'Logout',
  'Help',
  'Plus',
  'Trash',
  'Edit',
  'Save',
  'Check',
  'Close',
  'X',
  'Refresh',
  'More',
  'ChevronDown',
  'ChevronRight',
  'ChevronLeft',
  'ChevronUp',
  'Left',
  'Right',
  'ArrowRight',
  'Home',
  'Layers',
  'ShoppingBag',
  'Package',
  'Loader',
  'Shield',
  'ShieldCheck',
  'ShieldAlert',
  'database',
  'Globe',
  'Palette',
  'Mail',
  'Link',
  'Activity',
  'Alert',
  'Warning',
  'Clock',
  'Terminal',
  'Box',
  'Download',
  'Down',
  'Eye',
  'Code',
  'File',
  'Upload',
  'Grid',
  'List',
  'FolderPlus',
  'Folder',
  'External',
  'Lock',
  'UserCheck',
  'Calendar',
  'Zap',
  'Text',
  'Star',
  'webhook',
  'Orbit',
  'Image',
  'Info',
  'Fingerprint',
  'Key',
  'CheckCircle2',
  'Puzzle',
  'UserPlus'
];

function toExportIdentifier(name: string): string | null {
  const sanitized = String(name || '').replace(/[^A-Za-z0-9_$]/g, '');
  if (!sanitized) return null;
  if (/^[0-9]/.test(sanitized)) return `I${sanitized}`;
  return sanitized;
}

export function generateAdminRegistryContent(): string {
  const uniqueNames = Array.from(
    new Set(
      [...SYSTEM_ICON_NAMES, ...Object.keys(Lucide)]
        .map((name) => String(name || '').trim())
        .filter(Boolean)
    )
  );
  const exports = uniqueNames
    .map((name) => {
      const identifier = toExportIdentifier(name);
      if (!identifier) return null;
      return `export const ${identifier} = __icons["${name}"];`;
    })
    .filter(Boolean)
    .join('\n');

  return [
    'const __icons = (globalThis.FrameworkIcons || globalThis.Lucide || {});',
    exports,
    'export default __icons;'
  ]
    .filter(Boolean)
    .join('\n');
}
