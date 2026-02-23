# Fromcode Framework: Brutalist-Soft Design System

**Version**: 1.0.0  
**Last Updated**: February 17, 2026

This document defines the official design language for all Fromcode plugin UIs, based on the "Brutalist-Soft" aesthetic established in the CMS, Ecommerce, Finance, and Analytics plugins.

---

## Philosophy

The Brutalist-Soft design system combines:
- **Brutalist principles**: Bold typography, high contrast, function-first layouts, raw geometric shapes
- **Soft modernism**: Generous rounded corners, subtle shadows, smooth gradients, polished micro-interactions

**Core Values**:
1. **Clarity over decoration** - Every element serves a purpose
2. **Boldness with warmth** - Strong typography softened by curves
3. **Data-first hierarchy** - Metrics and actions always visible
4. **Consistent motion** - Predictable, purposeful animations

---

## Color Palette

### Primary Colors
```css
--color-primary: #4F46E5;        /* indigo-600 */
--color-primary-dark: #4338CA;   /* indigo-700 */
--color-primary-light: #818CF8;  /* indigo-400 */
```

### Semantic Colors
```css
--color-success: #10B981;        /* emerald-600 */
--color-warning: #F59E0B;        /* amber-600 */
--color-danger: #EF4444;         /* rose-600 */
--color-info: #0EA5E9;           /* sky-600 */
```

### Neutral Palette
```css
--color-neutral-50: #F8FAFC;     /* slate-50 */
--color-neutral-100: #F1F5F9;    /* slate-100 */
--color-neutral-200: #E2E8F0;    /* slate-200 */
--color-neutral-400: #94A3B8;    /* slate-400 */
--color-neutral-600: #475569;    /* slate-600 */
--color-neutral-800: #1E293B;    /* slate-800 */
--color-neutral-900: #0F172A;    /* slate-900 */
```

### Usage Guidelines
- **Primary**: CTA buttons, active states, links, primary icons
- **Success**: Completion states, positive trends, confirmations
- **Warning**: Alerts, pending states, incomplete data
- **Danger**: Errors, dangerous actions, critical alerts
- **Info**: Informational messages, neutral highlights
- **Neutral**: Text, borders, backgrounds, disabled states

---

## Typography

### Type Scale
```css
/* Headers */
--text-4xl: 2.25rem;     /* 36px - Page titles */
--text-3xl: 1.875rem;    /* 30px - Section headers */
--text-2xl: 1.5rem;      /* 24px - Card headers */
--text-xl: 1.25rem;      /* 20px - Subsections */

/* Body */
--text-base: 1rem;       /* 16px - Default text */
--text-sm: 0.875rem;     /* 14px - Secondary text */

/* Micro */
--text-xs: 0.75rem;      /* 12px - Labels */
--text-2xs: 0.625rem;    /* 10px - Micro labels, badges */
```

### Font Weights
```css
--font-black: 900;       /* Headers, metrics, emphasis */
--font-bold: 700;        /* Buttons, labels */
--font-semibold: 600;    /* Body text */
--font-normal: 400;      /* Muted text */
```

### Typography Patterns

#### Page Headers
```tsx
<h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-3 italic">
  Intelligence Stream
</h1>
<p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest opacity-70">
  High-fidelity behavioral analytics and site event telemetry
</p>
```

#### Section Headers
```tsx
<h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">
  Traffic Acquisition
</h3>
<p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">
  Organic vs Paid Distribution
</p>
```

#### Metric Values
```tsx
<h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-1 tabular-nums tracking-tighter">
  {value}
</h3>
<p className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-70">
  {label}
</p>
```

---

## Spacing & Layout

### Spacing Scale
```css
--space-1: 0.25rem;      /* 4px */
--space-2: 0.5rem;       /* 8px */
--space-3: 0.75rem;      /* 12px */
--space-4: 1rem;         /* 16px */
--space-6: 1.5rem;       /* 24px */
--space-8: 2rem;         /* 32px */
--space-10: 2.5rem;      /* 40px */
--space-12: 3rem;        /* 48px */
```

### Container Padding
- **Page wrapper**: `px-6 lg:px-12 pt-12 pb-24`
- **Card padding**: `p-8` to `p-10`
- **Metric cards**: `p-8`
- **Compact cards**: `p-4` to `p-6`

### Grid Layouts
```tsx
{/* Metrics (4 columns) */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

{/* Dashboard (2:1 ratio) */}
<div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
  <div className="xl:col-span-2">{/* Chart */}</div>
  <div>{/* Sidebar */}</div>
</div>
```

---

## Border Radius

### Radius Scale
```css
--radius-sm: 0.5rem;      /* 8px - Small elements */
--radius-md: 0.75rem;     /* 12px - Buttons */
--radius-lg: 1rem;        /* 16px - Icons */
--radius-xl: 1.5rem;      /* 24px - Button groups */
--radius-2xl: 2.5rem;     /* 40px - Cards */
--radius-3xl: 3rem;       /* 48px - Large containers */
```

### Usage
- **Cards**: `rounded-[2.5rem]` or `rounded-[48px]`
- **Buttons**: `rounded-2xl`
- **Icon containers**: `rounded-2xl`
- **Input fields**: `rounded-xl`
- **Tables**: `rounded-3xl` (outer container)

---

## Shadows

### Shadow Scale
```css
/* Subtle elevation */
box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);

/* Card elevation */
box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);

/* Floating elements */
box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);

/* Colored shadows (for accents) */
box-shadow: 0 4px 14px 0 rgb(79 70 229 / 0.2);  /* indigo */
```

### Usage
- **Metric cards**: `shadow-sm`
- **Floating panels**: `shadow-lg`
- **Colored accents**: `shadow-lg shadow-indigo-600/20`
- **Hover states**: Increase shadow on interaction

---

## Components

### Metric Card
**Purpose**: Display KPI with icon, value, trend, and label

**Example**:
```tsx
<div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:border-indigo-500/50 group">
  <div className="flex items-center justify-between mb-6">
    <div className="p-4 rounded-2xl ring-4 transition-transform group-hover:scale-110 duration-300 text-indigo-600 bg-indigo-500/10 ring-indigo-500/5">
      <Users size={24} />
    </div>
    <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600">
      +12.5%
    </span>
  </div>
  <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-1 tabular-nums tracking-tighter">
    1,234
  </h3>
  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-70">
    Total Visitors
  </p>
</div>
```

**Color Variants**:
- `text-indigo-600 bg-indigo-500/10 ring-indigo-500/5`
- `text-emerald-600 bg-emerald-500/10 ring-emerald-500/5`
- `text-blue-600 bg-blue-500/10 ring-blue-500/5`
- `text-rose-600 bg-rose-500/10 ring-rose-500/5`
- `text-amber-600 bg-amber-500/10 ring-amber-500/5`

---

### Chart Card
**Purpose**: Container for data visualizations with time range selector

**Example**:
```tsx
<div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-10 shadow-sm relative overflow-hidden">
  <div className="flex items-center justify-between mb-12 relative z-10">
    <div>
      <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">
        Traffic Acquisition
      </h3>
      <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">
        Organic vs Paid Distribution
      </p>
    </div>
    <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl border border-slate-100 dark:border-slate-700">
      {[7, 30, 90].map(days => (
        <button 
          key={days}
          className={`h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            days === 30 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
              : 'text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          {days}d
        </button>
      ))}
    </div>
  </div>
  
  {/* Chart content */}
  <div className="h-72">{/* Visualization */}</div>
</div>
```

---

### Empty State
**Purpose**: Guide users when collections are empty

**Example**:
```tsx
<div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-4 py-24">
  <FileText size={48} strokeWidth={1} />
  <p className="text-[10px] font-black uppercase tracking-widest">
    No behavioral data yet
  </p>
</div>
```

**Variants with CTA**:
```tsx
<div className="text-center py-16">
  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-500/10 mb-6">
    <Package size={32} className="text-indigo-600" />
  </div>
  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
    No Products Yet
  </h3>
  <p className="text-slate-500 mb-8 text-sm">
    Start by creating your first product
  </p>
  <button className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-[0.98]">
    Add Product
  </button>
</div>
```

---

### Button Styles

#### Primary Action
```tsx
<button className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20">
  Create Order
</button>
```

#### Secondary Action
```tsx
<button className="px-8 py-4 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-500 hover:text-indigo-500 transition-all active:scale-[0.98]">
  Export CSV
</button>
```

#### Dashed Ghost Button (for empty states)
```tsx
<button className="mt-8 w-full py-4 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:border-indigo-500 hover:text-indigo-500 transition-all active:scale-[0.98]">
  Full Audit Report
</button>
```

---

### Badge/Tag Styles

#### Status Badges
```tsx
{/* Success */}
<span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600">
  Active
</span>

{/* Warning */}
<span className="text-[10px] font-black px-3 py-1 rounded-full bg-amber-500/10 text-amber-600">
  Pending
</span>

{/* Danger */}
<span className="text-[10px] font-black px-3 py-1 rounded-full bg-rose-500/10 text-rose-600">
  Failed
</span>

{/* Info */}
<span className="text-[10px] font-black px-3 py-1 rounded-full bg-sky-500/10 text-sky-600">
  Draft
</span>
```

#### Trend Indicators
```tsx
<span className={`text-[10px] font-black px-3 py-1 rounded-full ${
  trend.startsWith('+') 
    ? 'bg-emerald-500/10 text-emerald-600' 
    : 'bg-rose-500/10 text-rose-600'
}`}>
  {trend}
</span>
```

---

### Data Tables

#### Container Style
```tsx
<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
  <table className="w-full">
    {/* Table content */}
  </table>
</div>
```

#### Header Row
```tsx
<thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
  <tr>
    <th className="text-left py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500">
      Order
    </th>
  </tr>
</thead>
```

#### Body Rows
```tsx
<tbody>
  <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
    <td className="py-4 px-6 text-sm font-semibold text-slate-900 dark:text-white">
      #ORD-1234
    </td>
  </tr>
</tbody>
```

---

### Loading States

#### Skeleton Screens
```tsx
<div className="animate-pulse">
  <div className="h-16 w-64 bg-slate-100 dark:bg-slate-900 rounded-2xl mb-6" />
  <div className="grid grid-cols-4 gap-6">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="h-44 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm" />
    ))}
  </div>
</div>
```

#### Spinner (for inline loading)
```tsx
<div className="flex items-center gap-2">
  <Loader2 className="animate-spin" size={16} />
  <span className="text-sm">Loading...</span>
</div>
```

---

## Animations

### Entrance Animations
```tsx
{/* Page entrance */}
<div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">

{/* Staggered list items */}
<div className="animate-in fade-in slide-in-from-left-4 duration-700" style={{ animationDelay: `${index * 100}ms` }}>
```

### Hover Transitions
```tsx
{/* Icon scale on hover */}
<div className="transition-transform group-hover:scale-110 duration-300">

{/* Border color transition */}
<div className="transition-all hover:border-indigo-500/50">

{/* Shadow expansion */}
<div className="transition-shadow hover:shadow-lg">
```

### Button Press
```tsx
<button className="active:scale-[0.98] transition-transform">
```

---

## Dark Mode

All components must support dark mode using Tailwind's `dark:` variant.

### Key Patterns
```tsx
{/* Backgrounds */}
className="bg-white dark:bg-slate-900"

{/* Text */}
className="text-slate-900 dark:text-white"
className="text-slate-600 dark:text-slate-400"

{/* Borders */}
className="border-slate-200 dark:border-slate-800"

{/* Subtle backgrounds */}
className="bg-slate-50 dark:bg-slate-800"
```

---

## Icon Usage

**Icon Library**: Lucide React  
**Default Size**: 24px for metric cards, 16-20px for inline usage

### Icon Container Pattern
```tsx
<div className="p-4 rounded-2xl ring-4 text-indigo-600 bg-indigo-500/10 ring-indigo-500/5">
  <Users size={24} />
</div>
```

### Common Icons
- **Metrics**: `Users`, `TrendingUp`, `DollarSign`, `Package`
- **Actions**: `Plus`, `Edit`, `Trash2`, `Download`
- **Status**: `CheckCircle`, `AlertTriangle`, `Clock`, `XCircle`
- **Navigation**: `ChevronRight`, `ArrowRight`, `Menu`
- **Data**: `BarChart3`, `PieChart`, `Activity`, `Zap`

---

## Accessibility

### ARIA Labels
```tsx
<button aria-label="Create new product">
  <Plus size={20} />
</button>
```

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Use `tabIndex={0}` for custom interactive components
- Provide visible focus states: `focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`

### Color Contrast
- Maintain WCAG AA (4.5:1 for normal text, 3:1 for large text)
- Test with dark mode enabled
- Never use color alone to convey information

---

## Implementation Checklist

When building a new plugin UI, ensure:

- [ ] Uses `font-black` for headers and metrics
- [ ] Card corners are `rounded-[2.5rem]` or `rounded-[48px]`
- [ ] Buttons use `rounded-2xl` with uppercase `tracking-widest` text
- [ ] Micro labels are `text-[10px] font-black uppercase tracking-widest`
- [ ] Empty states include icon, message, and call-to-action
- [ ] Loading states use skeleton screens or spinners
- [ ] Hover states include smooth transitions
- [ ] Dark mode works correctly
- [ ] ARIA labels provided for interactive elements
- [ ] Color contrast meets WCAG AA standards

---

## Reference Implementations

**Gold Standard Plugins** (copy patterns from these):
1. **Ecommerce**: [store-overview.tsx](../plugins/ecommerce/ui/src/store-overview.tsx)
2. **Finance**: [finance-overview.tsx](../plugins/finance/ui/src/finance-overview.tsx)
3. **Analytics**: [analytics-overview.tsx](../plugins/analytics/ui/src/analytics-overview.tsx)
4. **CMS**: [cms-dashboard.tsx](../plugins/cms/ui/src/components/cms-dashboard.tsx)

**Shared Components** (reusable):
- `packages/admin/components/ui/` - Base admin components
- `packages/admin/components/plugin-dashboard/` - Plugin-specific dashboard components (to be created)

---

## Version History

- **1.0.0** (Feb 17, 2026): Initial design system documentation based on audit of CMS, Ecommerce, Finance, and Analytics plugins

---

_This design system is a living document. Propose changes via pull request with examples from reference implementations._
