import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger' | 'go'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  filled:   'bg-m-primary text-m-on-primary',
  tonal:    'bg-m-secondary-container text-m-on-secondary-container',
  outlined: 'border border-m-outline text-m-primary bg-transparent',
  text:     'text-m-primary bg-transparent',
  danger:   'bg-m-error-container text-m-on-error-container',
  go:       'bg-x-go text-[color:var(--x-on-bright)]',
}
// M3 Expressive button sizes: S 40, M 48 (touch-friendly middle), L 56
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-sm gap-1.5',
  md: 'h-12 px-5 text-base gap-2',
  lg: 'h-14 px-6 text-base gap-2',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  full?: boolean
}

/** Fully rounded M3 button; squares up slightly when pressed (shape morph). */
export function Button({ variant = 'filled', size = 'md', icon, full, className = '', children, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`m-press inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap disabled:opacity-40 ${VARIANT[variant]} ${SIZE[size]} ${full ? 'w-full' : ''} ${className}`}
    >
      {icon}
      {children}
    </button>
  )
}

/** Round icon-only button (48px target). */
export function IconButton({ label, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      className={`m-press w-12 h-12 inline-flex items-center justify-center rounded-full ${className}`}
    >
      {children}
    </button>
  )
}
