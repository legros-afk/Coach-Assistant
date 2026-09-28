import type { Config } from 'tailwindcss'

// Tailwind reads everything from the design tokens in src/styles/globals.css,
// so screens say *what* a colour is for (bg-m-surface-container) rather than
// which colour it is — and light/dark come for free.
const role = (name: string) => `var(--${name})`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: role('brand'),
          on: role('on-brand'),
          'on-variant': role('on-brand-variant'),
          control: role('brand-bar-control'),
        },
        m: {
          primary: role('m-primary'),
          'on-primary': role('m-on-primary'),
          'primary-container': role('m-primary-container'),
          'on-primary-container': role('m-on-primary-container'),
          secondary: role('m-secondary'),
          'secondary-container': role('m-secondary-container'),
          'on-secondary-container': role('m-on-secondary-container'),
          tertiary: role('m-tertiary'),
          'tertiary-container': role('m-tertiary-container'),
          'on-tertiary-container': role('m-on-tertiary-container'),
          error: role('m-error'),
          'on-error': role('m-on-error'),
          'error-container': role('m-error-container'),
          'on-error-container': role('m-on-error-container'),
          surface: role('m-surface'),
          'surface-container-lowest': role('m-surface-container-lowest'),
          'surface-container-low': role('m-surface-container-low'),
          'surface-container': role('m-surface-container'),
          'surface-container-high': role('m-surface-container-high'),
          'surface-container-highest': role('m-surface-container-highest'),
          'on-surface': role('m-on-surface'),
          'on-surface-variant': role('m-on-surface-variant'),
          outline: role('m-outline'),
          'outline-variant': role('m-outline-variant'),
          'inverse-surface': role('m-inverse-surface'),
          'inverse-on-surface': role('m-inverse-on-surface'),
        },
        x: {
          good: role('x-good'),
          'good-container': role('x-good-container'),
          'on-good-container': role('x-on-good-container'),
          warn: role('x-warn'),
          'warn-container': role('x-warn-container'),
          'on-warn-container': role('x-on-warn-container'),
          win: role('x-win'),
          loss: role('x-loss'),
          draw: role('x-draw'),
          go: role('x-go'),
          pause: role('x-pause'),
          'live-bar': role('x-live-bar'),
        },
        pos: {
          forward: role('pos-forward'),
          back: role('pos-back'),
          scrumhalf: role('pos-scrumhalf'),
        },
      },
      // M3 type scale, in rem so it follows the phone's text-size setting
      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1rem' }],     // body small / label medium — 12
        sm:   ['0.875rem', { lineHeight: '1.25rem' }],  // body medium / label large — 14
        base: ['1rem',     { lineHeight: '1.5rem' }],   // body large / title medium — 16
        lg:   ['1.375rem', { lineHeight: '1.75rem' }],  // title large — 22
        xl:   ['1.5rem',   { lineHeight: '2rem' }],     // headline small — 24
        '2xl':['1.75rem',  { lineHeight: '2.25rem' }],  // headline medium — 28
        '3xl':['2rem',     { lineHeight: '2.5rem' }],   // headline large — 32
        '4xl':['2.25rem',  { lineHeight: '2.75rem' }],  // display small — 36
      },
      borderRadius: {
        'm-xs': 'var(--shape-xs)',
        'm-sm': 'var(--shape-sm)',
        'm-md': 'var(--shape-md)',
        'm-lg': 'var(--shape-lg)',
        'm-xl': 'var(--shape-xl)',
      },
      spacing: {
        13: '3.25rem',
      },
      fontFamily: {
        sans: ['Roboto Flex Variable', 'Roboto Flex', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['Roboto Flex Variable', 'Roboto Flex', 'Roboto', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        spring: 'var(--spring-default)',
        'spring-fast': 'var(--spring-fast)',
        effects: 'var(--effects)',
      },
    },
  },
  plugins: [],
} satisfies Config
