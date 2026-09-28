import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CheckCircle2, KeyRound, Link2, Share2 } from 'lucide-react'
import { getClubPin, setClubPin } from '@/lib/drive/driveRead'
import { FORMATS } from '@/lib/domain/validateComposition'
import { getDefaultFormat, setDefaultFormat } from '@/lib/prefs'
import { getKickoffDefaults, saveKickoffDefaults, spondConfigured, getSpondCreds } from '@/lib/spond/spondStore'
import { DEMO_SQUAD_ID, useSquadStore } from '@/features/squad/useSquadStore'
import SpondSheet from '@/features/spond/SpondSheet'
import { TopAppBar } from '@/ui/TopAppBar'
import { Button } from '@/ui/Button'
import { ButtonGroup } from '@/ui/ButtonGroup'
import { Card } from '@/ui/Card'
import { getAppearance, setAppearance, type Appearance } from '@/ui/theme'

interface Props {
  onBack: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </Card>
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

  // ── appearance
  const [appearance, setAppearanceState] = useState<Appearance>(getAppearance)
  const chooseAppearance = (a: Appearance) => { setAppearance(a); setAppearanceState(a) }

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
    // The QR library needs literal colours; dark on white scans best in any theme
    QRCode.toDataURL(appUrl, { margin: 1, width: 440, color: { dark: '#1E1A20', light: '#FFFFFF' } })
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

  const fieldClass = 'h-14 px-4 rounded-m-xs border border-m-outline bg-transparent text-m-on-surface outline-none focus:border-m-primary focus:ring-1 focus:ring-m-primary'

  return (
    <div className="min-h-screen bg-m-surface text-m-on-surface">
      <TopAppBar title="Settings" onBack={onBack} />

      <div className="px-4 pt-2 pb-12 space-y-3 max-w-md mx-auto">
        <Section title="Coach PIN">
          {!editingPin && hasPin ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 size={24} className="text-x-good flex-shrink-0" strokeWidth={2.25} />
              <div className="flex-1 text-base">Set — you can pick teams and share them.</div>
              <Button variant="tonal" size="sm" onClick={() => setEditingPin(true)}>Change</Button>
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed mb-3 text-m-on-surface-variant">
                Ask your head coach for it. It lets you pick teams and share them with the other
                coaches. You don’t need it to run a match.
              </p>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 rounded-m-xs border border-m-outline focus-within:border-m-primary focus-within:ring-1 focus-within:ring-m-primary">
                  <KeyRound size={20} className="flex-shrink-0 text-m-on-surface-variant" />
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
                    className="w-full h-14 text-2xl tracking-[0.4em] text-center outline-none bg-transparent"
                  />
                </div>
                <Button size="lg" onClick={savePin} disabled={pin.length === 0}>Save</Button>
              </div>
            </>
          )}
        </Section>

        <Section title="Appearance">
          <ButtonGroup
            full
            ariaLabel="Appearance"
            value={appearance}
            onChange={chooseAppearance}
            options={[
              { value: 'system', label: 'Automatic' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          <p className="text-sm mt-2 text-m-on-surface-variant">
            Automatic follows your phone. Light is easiest to read in bright sunshine.
          </p>
        </Section>

        <Section title="New fixtures">
          <p className="text-sm mb-3 text-m-on-surface-variant">
            The format new fixtures start with. You can still switch any fixture on the day.
          </p>
          <ButtonGroup
            full
            ariaLabel="Format for new fixtures"
            value={format}
            onChange={chooseFormat}
            options={FORMATS.map(n => ({ value: n, label: `${n}-a-side` }))}
          />
        </Section>

        {hasPin && (
          <Section title="Spond">
            <div className="flex items-center gap-3 mb-3">
              <Link2 size={20} strokeWidth={2.25} className={spondLinked ? 'text-x-good' : 'text-m-on-surface-variant'} />
              <div className="flex-1 text-base">
                {spondLinked ? `Connected${getSpondCreds().groupName ? ` · ${getSpondCreds().groupName}` : ''}` : 'Not connected'}
              </div>
              <Button variant="tonal" size="sm" onClick={() => setShowSpond(true)}>{spondLinked ? 'Manage' : 'Connect'}</Button>
            </div>
            {spondLinked && (
              <>
                <p className="text-sm mb-2 text-m-on-surface-variant">
                  Kick-off time and length used when you add a fixture to Spond.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={kickOff}
                    onChange={e => setKickOff(e.target.value)}
                    aria-label="Kick-off time"
                    className={fieldClass}
                  />
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={duration}
                    onChange={e => setDuration(parseInt(e.target.value, 10) || 120)}
                    aria-label="Length in minutes"
                    className={`${fieldClass} w-24`}
                  />
                  <span className="text-sm text-m-on-surface-variant">minutes</span>
                </div>
              </>
            )}
          </Section>
        )}

        <Section title="Add a coach">
          <p className="text-sm leading-relaxed mb-4 text-m-on-surface-variant">
            Have them scan this with their phone camera, then add the app to their Home Screen
            (Share → Add to Home Screen on iPhone). Give them the PIN in person.
          </p>
          {qr && <img src={qr} alt="QR code linking to Coach Assistant" className="w-52 h-52 mx-auto rounded-m-md" />}
          <Button
            variant="outlined"
            full
            className="mt-4"
            onClick={shareLink}
            icon={<Share2 size={18} strokeWidth={2.25} />}
          >
            {linkCopied ? 'Link copied' : 'Send the link instead'}
          </Button>
        </Section>

        {noRealSquad && (
          <Section title="Practice squad">
            <p className="text-sm mb-3 text-m-on-surface-variant">
              A made-up squad for trying the app out. It isn’t shared with anyone.
            </p>
            {isDemo ? (
              <Button variant="danger" full onClick={() => void squadStore.clearSquad()}>Remove practice squad</Button>
            ) : (
              <Button variant="tonal" full onClick={() => void squadStore.loadDemoSquad()}>Load practice squad</Button>
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
