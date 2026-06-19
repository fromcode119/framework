"use client";

import React from 'react';

export default function StarterHeroStyles() {
  return (
      <style>{`
        html, body { background: #04080f !important; color: #ffffff !important; margin: 0 !important; padding: 0 !important; }
        [data-sh] {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          text-transform: none !important;
          font-variant: normal !important;
          letter-spacing: normal !important;
        }
        [data-sh] div { background-color: transparent !important; border: none !important; }
        [data-sh] h1, [data-sh] h2, [data-sh] p, [data-sh] a, [data-sh] span {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          text-transform: none !important;
          font-variant: normal !important;
        }
        [data-sh] h1 {
          color: #ffffff !important;
          font-size: clamp(2.5rem, 6vw, 4.5rem) !important;
          font-weight: 900 !important;
          line-height: 1.05 !important;
          letter-spacing: -0.025em !important;
          text-align: center !important;
          max-width: 56rem !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        [data-sh] h2 {
          color: #ffffff !important;
          font-size: 0.875rem !important;
          font-weight: 700 !important;
          letter-spacing: 0 !important;
        }
        [data-sh] p {
          color: #94a3b8 !important;
          font-size: 1rem !important;
          line-height: 2 !important;
        }
        [data-sh] .sh-grad {
          background: linear-gradient(to right, #818cf8, #a5b4fc, #67e8f9) !important;
          background-clip: text !important;
          -webkit-background-clip: text !important;
          color: transparent !important;
          display: inline !important;
        }
        [data-sh] .sh-muted { color: #475569 !important; font-size: 0.75rem !important; }
        [data-sh] .sh-muted a { color: #64748b !important; }
        [data-sh] * { box-sizing: border-box; }
        [data-sh] .sh-center { text-align: center !important; }
        [data-sh] .sh-cta-row {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.75rem !important;
          flex-wrap: wrap !important;
          margin-top: 2.5rem !important;
        }
        [data-sh] .sh-btn-primary {
          display: inline-flex !important; align-items: center !important; justify-content: center !important;
          padding: 0.875rem 2rem !important; border-radius: 9999px !important;
          background-color: #4f46e5 !important; color: #ffffff !important;
          font-size: 0.875rem !important; font-weight: 700 !important;
          text-decoration: none !important; white-space: nowrap !important;
          box-shadow: 0 0 48px rgba(99,102,241,0.4) !important;
          min-width: 196px !important; border: none !important;
        }
        [data-sh] .sh-btn-secondary {
          display: inline-flex !important; align-items: center !important; justify-content: center !important;
          padding: 0.875rem 2rem !important; border-radius: 9999px !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          background-color: rgba(255,255,255,0.04) !important; color: #cbd5e1 !important;
          font-size: 0.875rem !important; font-weight: 700 !important;
          text-decoration: none !important; white-space: nowrap !important;
          min-width: 196px !important;
        }
        [data-sh] .sh-dark-bg { background-color: #04080f !important; }
        [data-sh] .sh-grid-3 { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        [data-sh] .sh-grid-wrap { margin-top: 5rem !important; width: 100% !important; max-width: 64rem !important; }
        [data-sh] .sh-grid-panel { background-color: rgba(255,255,255,0.02) !important; border: 1px solid rgba(255,255,255,0.07) !important; }
        [data-sh] .sh-pillar {
          display: flex !important; flex-direction: column !important; gap: 1rem !important;
          padding: 2rem !important;
        }
        [data-sh] .sh-feat-icon {
          font-size: 1.5rem !important; line-height: 1 !important;
          display: block !important; margin-bottom: 0.5rem !important;
        }
        [data-sh] .sh-footnote { margin-top: 4rem !important; padding-bottom: 2rem !important; }
        @media (max-width: 639px) {
          [data-sh] .sh-grid-3 { grid-template-columns: 1fr !important; }
          [data-sh] .sh-cta-row { flex-direction: column !important; }
        }
      `}</style>
  );
}
