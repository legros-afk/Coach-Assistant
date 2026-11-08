import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Phone, Siren } from 'lucide-react'
import { Sheet } from '@/ui/Sheet'

// RFU HEADCASE red flags: any one of these means call 999 now.
export const RED_FLAGS = [
  'Deteriorating or loss of consciousness',
  'Increasing confusion or irritability',
  'Severe or worsening headache',
  'Repeated vomiting',
  'Seizure or convulsion',
  'Double vision or deafness',
  'Weakness or tingling in arms and legs',
  'Not waking up or unresponsive',
] as const

/** The red flags and a big 999 button. Used in the sheet and as a reference page. */
export function RedFlagList() {
  return (
    <div className="space-y-4">
      <div className="text-base font-semibold">Call 999 straight away if they have any of these:</div>
      <ul className="space-y-2">
        {RED_FLAGS.map(f => (
          <li key={f} className="flex items-start gap-3 text-base leading-snug">
            <span aria-hidden="true" className="mt-1.5 w-2.5 h-2.5 rounded-full bg-m-error flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <a
        href="tel:999"
        className="m-press h-16 w-full rounded-full bg-m-error text-m-on-error font-bold text-xl inline-flex items-center justify-center gap-3"
      >
        <Phone size={24} strokeWidth={2.5} />
        Call 999
      </a>
      <div className="text-sm text-m-on-surface-variant leading-snug">
        If in doubt, sit them out. A player must never go back on the same day as a suspected concussion.
      </div>
    </div>
  )
}

/** Always-visible red flag button for injury and concussion screens. */
export function RedFlagButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`m-press h-10 px-4 rounded-full bg-m-error text-m-on-error text-sm font-bold inline-flex items-center gap-2 flex-shrink-0 ${className}`}
      >
        <Siren size={18} strokeWidth={2.5} />
        Red flags
      </button>
      {/* Portal: this button often sits inside another sheet */}
      {open && createPortal(
        <Sheet onClose={() => setOpen(false)} title="Red flags">
          <div className="pb-4"><RedFlagList /></div>
        </Sheet>,
        document.body,
      )}
    </>
  )
}
