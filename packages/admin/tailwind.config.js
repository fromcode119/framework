/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ai/src/**/*.{js,ts,jsx,tsx,mdx}", // Forge UI mounted via admin slot
    "../../plugins/**/*.{js,ts,jsx,tsx,mdx}", // Scanned locally; Docker build uses safelist below
  ],
  // Plugin UI components use arbitrary Tailwind values (e.g. grid-cols-[...], tracking-[...]).
  // The plugins/ directory is outside the Docker build context so it cannot be scanned at image
  // build time. The safelist ensures these classes are always emitted in the production CSS.
  safelist: [
    { pattern: /^grid-cols-\[/, variants: ['sm', 'md', 'lg', 'xl'] },
    { pattern: /^col-span-\[/, variants: ['sm', 'md', 'lg'] },
    { pattern: /^tracking-\[/ },
    { pattern: /^text-\[/ },
    { pattern: /^(h|w)-\[/, variants: ['sm', 'md', 'lg'] },
    { pattern: /^(min-h|min-w|max-h|max-w)-\[/, variants: ['sm', 'md', 'lg'] },
    { pattern: /^z-\[/ },
    { pattern: /^scale-\[/, variants: ['hover', 'active'] },
    { pattern: /^blur-\[/ },
    { pattern: /^shadow-\[/, variants: ['hover'] },
    { pattern: /^aspect-\[/ },
    // Plugin admin cards use arbitrary corner radii (rounded-[32px], rounded-l-[4px], …). These MUST
    // be LITERAL strings, not a { pattern } — a safelist regex only matches candidates Tailwind already
    // generates from scanned content; it does NOT synthesize arbitrary values. The Docker-built admin
    // CSS can't scan plugins/, so without these literals every such card renders SQUARE. Keep in sync
    // with: grep -rEoh 'rounded(-[a-z]+)?-\[[0-9]+px\]' plugins/*/src/ui
    'rounded-[1px]', 'rounded-[20px]', 'rounded-[24px]', 'rounded-[28px]', 'rounded-[32px]',
    'rounded-[36px]', 'rounded-[40px]', 'rounded-[48px]', 'rounded-[50px]', 'rounded-[56px]',
    'rounded-l-[4px]', 'rounded-r-[4px]',
  ],
  theme: {
    extend: {
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        shake: 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
        'fade-in-up': 'fade-in-up 0.3s ease-out forwards',
      }
    },
  },
  plugins: [],
}
