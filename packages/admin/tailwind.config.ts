import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

const config: Config = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}", // class constants (`lib/ui.ts`) the components above compose
    "../../packages/ai/src/**/*.{js,ts,jsx,tsx,mdx}", // Forge UI mounted via admin slot
    // Plugin admin UI is deliberately ABSENT here, and no glob or generated list belongs in its place.
    //
    // Plugins install at RUNTIME from tarballs, so the plugin set is not knowable when this stylesheet
    // is built — an image built today has to style a plugin installed tomorrow — and plugins/ is not in
    // the admin image's build context regardless. Every attempt to solve it from this side (a
    // `../../plugins/**` glob that resolved to an empty dir, a safelist that went stale on every plugin
    // edit, a generated class inventory that froze one checkout's plugin list into the image) worked
    // only where the framework happened to sit beside the plugins.
    //
    // Each plugin now compiles the utilities it uses into `src/ui/style.css` at pack time and ships it
    // in its own tarball; `PluginPackageLayout` derives `ui.css` from that file and the admin loads it
    // at runtime. See packages/sdk/src/tailwind/plugin-ui.tailwind.config.cjs.
  ],
  theme: {
    extend: {
      /*
       * The two palettes screens reached for by hand, pointed at the console's own colours.
       *
       * 289 files still colour themselves with `slate-*` and `indigo-*` utilities (1,294 and 286 uses)
       * instead of the console's tokens, which is why a screen nobody has redrawn yet looks like a
       * different product: a blue-grey ink beside the neutral one, an indigo tile beside the dark
       * button. Until each is moved onto a component, the names mean the console's colours:
       * `slate` is its neutral scale, and `indigo` is quiet at its light end and the interactive blue at
       * its strong end. One place to change, and nothing here is a colour the tokens do not have.
       */
      colors: {
        slate: colors.zinc,
        indigo: {
          50: '#f4f4f5', 100: '#e4e4e7', 200: '#d4d4d8', 300: '#93c5fd', 400: '#60a5fa',
          500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
        },
      },
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

export default config;
