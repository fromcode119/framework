"use client";

import React from 'react';
import type { PluginTrendChartProps, PluginTrendSeries } from './plugin-trend-chart.interfaces';

const DEFAULT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9'];

/**
 * Compact, dependency-free SVG area/line trend chart for plugin dashboards. Plots one or more series
 * over shared x labels. Reuse from `@fromcode119/sdk/admin` so every plugin's "metric over time"
 * dashboard looks the same and updates from one place. Render it inside a PluginChartCard.
 */
export class PluginTrendChart extends React.Component<PluginTrendChartProps> {
  private path(data: number[], max: number, w: number, h: number, pad: number): { line: string; area: string } {
    const n = data.length;
    if (n === 0) return { line: '', area: '' };
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const x = (i: number) => pad + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = (v: number) => pad + innerH - (max <= 0 ? 0 : (v / max) * innerH);
    const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const line = `M ${pts.join(' L ')}`;
    const area = `${line} L ${x(n - 1).toFixed(1)},${(h - pad).toFixed(1)} L ${x(0).toFixed(1)},${(h - pad).toFixed(1)} Z`;
    return { line, area };
  }

  render(): React.ReactNode {
    const { series, xLabels, height = 150, formatValue = (v) => String(v), className = '' } = this.props;
    const W = 600;
    const H = height;
    const pad = 8;
    const allValues = series.flatMap((s) => s.data);
    const max = Math.max(1, ...allValues);
    const empty = allValues.every((v) => !v);
    const firstLabel = xLabels[0] || '';
    const lastLabel = xLabels[xLabels.length - 1] || '';

    return (
      <div className={className}>
        <div className="relative w-full" style={{ height: `${H}px` }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
            <defs>
              {series.map((s, i) => {
                const color = s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
                return (
                  <linearGradient key={i} id={`fc-trend-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                  </linearGradient>
                );
              })}
            </defs>
            {[0.25, 0.5, 0.75].map((g) => (
              <line key={g} x1={pad} x2={W - pad} y1={pad + (H - pad * 2) * g} y2={pad + (H - pad * 2) * g} className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="1" />
            ))}
            {series.map((s: PluginTrendSeries, i) => {
              const color = s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
              const { line, area } = this.path(s.data, max, W, H, pad);
              return (
                <g key={i}>
                  <path d={area} fill={`url(#fc-trend-grad-${i})`} />
                  <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </g>
              );
            })}
          </svg>
          {empty && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-slate-300 dark:text-slate-600">
              No data for this range
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {series.map((s, i) => {
              const color = s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
              const peak = s.data.length ? Math.max(...s.data) : 0;
              return (
                <span key={i} className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                  {s.label}
                  <span className="text-slate-400 normal-case font-medium">· peak {formatValue(peak)}</span>
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-[10px] font-medium text-slate-400 shrink-0">
            <span>{firstLabel}</span>
            <span>{lastLabel}</span>
          </div>
        </div>
      </div>
    );
  }
}
