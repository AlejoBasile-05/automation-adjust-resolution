/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#080a0d',
          900: '#0b0e13',
          800: '#11151c',
          700: '#181d26',
          600: '#222935',
        },
        mist: {
          100: '#eef2f6',
          200: '#cbd3dd',
          300: '#9aa6b5',
          400: '#6f7b8c',
        },
        copper: {
          300: '#f2c27b',
          400: '#e8a94f',
          500: '#d98f2b',
          600: '#b8731c',
        },
        signal: {
          ok: '#5fd3a1',
          warn: '#f0b35a',
          bad: '#f0716a',
        },
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 24px 80px -40px rgba(0, 0, 0, 0.9)',
        focus: '0 0 0 3px rgba(232, 169, 79, 0.35)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        rise: 'rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        breathe: 'breathe 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
