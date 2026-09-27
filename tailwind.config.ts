import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          purple:        'var(--brand-purple)',
          'purple-dark': 'var(--brand-purple-dark)',
          'purple-light':'var(--brand-purple-light)',
          'purple-soft': 'var(--brand-purple-soft)',
          'purple-softer':'var(--brand-purple-softer)',
          ink:           'var(--brand-ink)',
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
      },
      minHeight: {
        tap: '56px',
      },
    },
  },
  plugins: [],
} satisfies Config
