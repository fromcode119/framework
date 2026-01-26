/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../plugins/**/*.{js,ts,jsx,tsx,mdx}", // To allow styling in plugins
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
