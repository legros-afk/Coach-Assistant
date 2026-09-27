import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CheckCircle, ChevronLeft, KeyRound, Link2, Share2 } from 'lucide-react'
import { getClubPin, setClubPin } from '@/lib/drive/driveRead'
import { FORMATS } from '@/lib/domain/validateComposition'
import { getDefaultFormat, setDefaultFormat } from '@/lib/prefs'
import { getKickoffDefaults, saveKickoffDefaults, spondConfigured, getSpondCreds } from '@/lib/spond/spondStore'
import { DEMO_SQUAD_ID, useSquadStore } from '@/features/squad/useSquadStore'
import SpondSheet from '@/features/spond/SpondSheet'

const PURPLE = '#3D0066'
const INK    = '#1A1A1A'
const MUTED  = '#6E6E73'
const BORDER = '#E5E5EA'

interface Props {
  onBack: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl p-4" style={{ border: `1px solid ${BORDER}` }}>
      <h2 className="text-lg font-bold mb-2" style={{ color: INK }}>{title}</h2>
      {children}
    </section>
  )
}

// Everything that isn't match day lives here, in plain words.
export default function SetupScreen({ onBack }: Props) {
  // ── coach PIN
  const [pin, setPin] = useState(() => getClubPin())
  const [hasPin, setHasPin] = useState(() => getClubPin().length > 0)
  const [editingPin, setEditingPin] = useState(() => getClubPin().length === 0)
  const savePin = () => {
    setClubPin(pin)
    setHasPin(pin.length > 0)
    setEditingPin(false)
  }

  // ── format for new fixtures
  const [format, setFormat] = useState(getDefaultFormat)
  const chooseFormat = (n: number) => { setDefaultFormat(n); setFormat(n) }

  // ── Spond
  const [spondLinked, setSpondLinked] = useState(spondConfigured)
  const [showSpond, setShowSpond] = useState(false)
  const [kickOff, setKickOff] = useState(() => getKickoffDefaults().kickOff)
  const [duration, setDuration] = useState(() => getKickoffDefaults().durationMins)
  useEffect(() => { saveKickoffDefaults(kickOff, duration) }, [kickOff, duration])

  // ── add a coach: a QR code of the app's address. The PIN is deliberately
  //    left out of the link — it's passed on in person.
  const appUrl = window.location.origin + '/'
  const [qr, setQr] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  useEffect(() => {
    QRCode.toDataURL(appUrl, { margin: 1, width: 440, color: { dark: '#1A1A1A', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => setQr(null))
  }, [appUrl])
  const shareLink = async () => {
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'Coach Assistant', url: appUrl }); return } catch { /* fall through */ }
    }
    try {
      await navigator.clipboard.writeText(appUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2200)
    } catch { /* link is shown on screen */ }
  }

  // ── practice data
  const squadStore = useSquadStore()
  const { isHydrated: squadReady, hydrate: hydrateSquad } = squadStore
  useEffect(() => { if (!squadReady) hydrateSquad() }, [squadReady, hydrateSquad])
  const squad = squadStore.squad
  const isDemo = squad?.id === DEMO_SQUAD_ID
  const noRealSquad = !squad || squad.players.length === 0 || isDemo

  return (
    <div className="min-h-screen" style={{ background: '#F2F2F7' }}>
      <div className="sticky top-0 z-20 safe-top" style={{ background: PURPLE }}>
      <div className="px-3 py-2.5 flex items-center gap-2">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center -ml-1" aria-label="Back">
          <ChevronLeft size={26} color="white" strokeWidth={2.5} />
        </button>
        <div className="text-[17px] font-bold text-white">Settings</div>
      </div>
      </div>

      <div className="px-3 py-4 space-y-3 max-w-md mx-auto pb-12">
        <Section title="Coach PIN">
          {!editingPin && hasPin ? (
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-emerald-600 flex-shrink-0" strokeWidth={2.5} />
              <div className="flex-1 text-[15px]" style={{ color: INK }}>
                Set — you can pick teams and share them.
              </div>
              <button onClick={() => setEditingPin(true)} className="h-10 px-3 text-sm font-semibold rounded-lg" style={{ color: PURPLE, background: '#F1EAF6' }}>
                Change
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed mb-3" style={{ color: MUTED }}>
                Ask your head coach for it. It lets you pick teams and share them with the other
                coaches. You don’t need it to run a match.
              </p>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 rounded-lg border-2" style={{ borderColor: '#D1D1D6' }}>
                  <KeyRound size={18} className="flex-shrink-0 text-[#8E8E93]" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && savePin()}
                    placeholder="0000"
                    aria-label="Coach PIN"
                    className="w-full py-3 text-2xl tracking-[0.4em] text-center outline-none bg-transparent"
                    style={{ color: INK }}
                  />
                </div>
                <button
                  onClick={savePin}
                  disabled={pin.length === 0}
                  className="px-5 rounded-lg font-bold text-base disabled:opacity-40 active:scale-95 transition"
                  style={{ background: PURPLE, color: 'white' }}
                >
                  Save
                </button>
              </div>
            </>
          )}
        </Section>

        <Section title="New fixtures">
          <p className="text-sm mb-3" style={{ color: MUTED }}>
            The format new fixtures start with. You can still switch any fixture on the day.
          </p>
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            {FORMATS.map(n => (
              <button
                key={n}
                onClick={() => chooseFormat(n)}
                className="flex-1 h-11 text-sm font-bold transition"
                style={{ background: format === n ? PURPLE : 'white', color: format === n ? 'white' : '#5B1A99' }}
              >
                {n}-a-side
              </button>
            ))}
          </div>
        </Section>

        {hasPin && (
          <Section title="Spond">
            <div className="flex items-center gap-3 mb-3">
              <Link2 size={18} strokeWidth={2.5} style={{ color: spondLinked ? '#059669' : MUTED }} />
              <div className="flex-1 text-[15px]" style={{ color: INK }}>
                {spondLinked ? `Connected${getSpondCreds().groupName ? ` · ${getSpondCreds().groupName}` : ''}` : 'Not connected'}
              </div>
              <button
                onClick={() => setShowSpond(true)}
                className="h-10 px-3 text-sm font-semibold rounded-lg"
                style={{ color: PURPLE, background: '#F1EAF6' }}
              >
                {spondLinked ? 'Manage' : 'Connect'}
              </button>
            </div>
            {spondLinked && (
              <>
                <p className="text-sm mb-2" style={{ color: MUTED }}>
                  Kick-off time and length used when you add a fixture to Spond.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={kickOff}
                    onChange={e => setKickOff(e.target.value)}
                    aria-label="Kick-off time"
                    className="h-11 px-2 rounded-lg border text-[15px] outline-none"
                    style={{ borderColor: BORDER, color: INK }}
                  />
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={duration}
                    onChange={e => setDuration(parseInt(e.target.value, 10) || 120)}
                    aria-label="Length in minutes"
                    className="h-11 w-20 px-2 rounded-lg border text-[15px] outline-none"
                    style={{ borderColor: BORDER, color: INK }}
                  />
                  <span className="text-sm" style={{ color: MUTED }}>minutes</span>
                </div>
              </>
            )}
          </Section>
        )}

        <Section title="Add a coach">
          <p className="text-sm leading-relaxed mb-3" style={{ color: MUTED }}>
            Have them scan this with their phone camera, then add the app to their Home Screen
            (Share → Add to Home Screen on iPhone). Give them the PIN in person.
          </p>
          {qr && <img src={qr} alt="QR code linking to Coach Assistant" className="w-52 h-52 mx-auto rounded-lg" />}
          <button
            onClick={shareLink}
            className="w-full mt-3 h-12 rounded-lg font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition"
            style={{ background: 'white', border: `2px solid ${PURPLE}`, color: PURPLE }}
          >
            <Share2 size={16} strokeWidth={2.5} />
            {linkCopied ? 'Link copied' : 'Send the link instead'}
          </button>
        </Section>

        {noRealSquad && (
          <Section title="Practice squad">
            <p className="text-sm mb-3" style={{ color: MUTED }}>
              A made-up squad for trying the app out. It isn’t shared with anyone.
            </p>
            {isDemo ? (
              <button
                onClick={() => void squadStore.clearSquad()}
                className="w-full h-11 rounded-lg text-sm font-bold"
                style={{ background: '#FDECEC', color: '#B42318' }}
              >
                Remove practice squad
              </button>
            ) : (
              <button
                onClick={() => void squadStore.loadDemoSquad()}
                className="w-full h-11 rounded-lg text-sm font-bold"
                style={{ background: '#F1EAF6', color: PURPLE }}
              >
                Load practice squad
              </button>
            )}
          </Section>
        )}
      </div>

      {showSpond && (
        <SpondSheet
          onClose={() => { setShowSpond(false); setSpondLinked(spondConfigured()) }}
          onConnected={() => setSpondLinked(true)}
        />
      )}
    </div>
  )
}
