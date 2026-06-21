import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue:        'var(--brand-blue)',
          'blue-dark': 'var(--brand-blue-dark)',
          gold:        'var(--brand-gold)',
          red:         'var(--brand-red)',
          'blue-soft': 'var(--brand-blue-soft)',
          'blue-softer':'var(--brand-blue-softer)',
          ink:         'var(--brand-ink)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      minHeight: {
        tap: '56px',
      },
    },
  },
  plugins: [],
} satisfies Config
