/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      // Design tokens — will be refined with actual brand colours
      colors: {
        brand: {
          50:  '#fef9ee',
          100: '#fef0d1',
          200: '#fcdea2',
          300: '#f9c469',
          400: '#f5a02d',
          500: '#f28210',   // Primary — warm amber/gold (pan-African palette)
          600: '#e36a07',
          700: '#bc4f09',
          800: '#963e0e',
          900: '#7a340f',
        },
        // Dark surface palette for readability at night on dim screens
        surface: {
          50:  '#f8f7f4',
          100: '#eeede8',
          200: '#dedad0',
          800: '#292520',
          900: '#1a1714',
          950: '#0f0d0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
  // Dark mode: class-based so user preference is respected
  darkMode: 'class',
};
