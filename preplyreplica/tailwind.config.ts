import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f2f9fb',
          100: '#eaf6fb',
          200: '#cdeaf2',
          300: '#8fd3e6',
          400: '#41b4d9',
          500: '#0891b2',
          600: '#04748f',
          700: '#065f75',
          800: '#0a4c5e',
          900: '#0c3e4d',
        },
        muted: {
          50: '#f8fafc',
          100: '#f1f5f9',
          300: '#cbd5e1',
          500: '#64748b',
          700: '#334155',
        },
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.08)',
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)',
        lift: '0 20px 40px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
}

export default config
