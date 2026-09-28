import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const FIELD = 'w-full px-4 rounded-m-xs border border-m-outline bg-transparent text-m-on-surface placeholder:text-m-outline outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary transition-colors'

/** M3 outlined text field with its label above. */
export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string }>(
  function TextField({ label, className = '', ...rest }, ref) {
    return (
      <label className="block">
        <span className="block text-sm font-medium text-m-on-surface-variant mb-1.5">{label}</span>
        <input ref={ref} {...rest} className={`${FIELD} h-14 ${className}`} />
      </label>
    )
  },
)

export function TextArea({ label, className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-m-on-surface-variant mb-1.5">{label}</span>
      <textarea {...rest} className={`${FIELD} py-3 resize-none ${className}`} />
    </label>
  )
}
