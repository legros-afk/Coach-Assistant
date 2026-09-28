import type { HTMLAttributes } from 'react'

/** M3 filled card: a tonal container, no border. */
export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={`bg-m-surface-container rounded-m-lg ${className}`} />
}

/** Section heading above a group of cards. */
export function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-sm font-semibold text-m-on-surface-variant mt-6 mb-2 px-1 ${className}`}>{children}</h2>
}
