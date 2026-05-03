import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, Plus, Undo2, X, Check, AlertTriangle, Heart, Activity, ArrowRight, Trophy } from 'lucide-react';

// Woodford brand colours, sampled from the official 2018 CMYK logo
const WOODFORD = {
  purple: '#782880',
  purpleDark: '#5C1E63',
  purpleLight: '#9B4FA1',
  purpleSoft: '#F4E8F5',
  purpleSofter: '#FAF3FB',
  ink: '#201820',
};

const initialPlayers = [
  { id: 1, name: 'Smith', group: 'forward', eligible: ['forward'], status: 'on', minutes: 18.7 * 60, tries: 1 },
  { id: 2, name: 'Jones', group: 'forward', eligible: ['forward'], status: 'on', minutes: 17.2 * 60, tries: 0 },
  { id: 3, name: 'Brown', group: 'forward', eligible: ['forward', 'back'], status: 'on', minutes: 15.5 * 60, tries: 0 },
  { id: 4, name: 'Davies', group: 'forward', eligible: ['forward'], status: 'on', minutes: 14.0 * 60, tries: 0 },
  { id: 5, name: 'Evans', group: 'forward', eligible: ['forward'], status: 'on', minutes: 12.8 * 60, tries: 0 },
  { id: 6, name: 'Khan', group: 'back', eligible: ['back'], status: 'on', minutes: 16.4 * 60, tries: 1 },
  { id: 7, name: 'Patel', group: 'back', eligible: ['back'], status: 'on', minutes: 15.9 * 60, tries: 0 },
  { id: 8, name: 'Lewis', group: 'back', eligible: ['back', 'scrumhalf'], status: 'on', minutes: 13.1 * 60, tries: 1 },
  { id: 9, name: 'Murphy', group: 'back', eligible: ['back'], status: 'on', minutes: 11.5 * 60, tries: 0 },
  { id: 10, name: 'Nolan', group: 'back', eligible: ['back'], status: 'on', minutes: 10.2 * 60, tries: 0 },
  { id: 11, name: "O'Neill", group: 'scrumhalf', eligible: ['scrumhalf', 'back'], status: 'on', minutes: 19.3 * 60, tries: 0 },
  { id: 12, name: 'Patterson', group: 'forward', eligible: ['forward'], status: 'bench', minutes: 4.2 * 60, tries: 0 },
  { id: 13, name: 'Quinn', group: 'forward', eligible: ['forward'], status: 'bench', minutes: 6.8 * 60, tries: 0 },
  { id: 14, name: 'Roberts', group: 'back', eligible: ['back'], status: 'bench', minutes: 3.5 * 60, tries: 0 },
  { id: 15, name: 'Singh', group: 'back', eligible: ['back', 'forward'], status: 'bench', minutes: 7.1 * 60, tries: 0 },
  { id: 16, name: 'Taylor', group: 'scrumhalf', eligible: ['scrumhalf'], status: 'bench', minutes: 2.9 * 60, tries: 0 },
  { id: 17, name: 'Wilson', group: 'forward', eligible: ['forward'], status: 'blood', minutes: 9.3 * 60, tries: 0 },
];

const groupLabel = { forward: 'F', back: 'B', scrumhalf: 'SH' };

const fmt = (s) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const balanceColor = (mins, avg) => {
  const diff = mins - avg;
  if (Math.abs(diff) < 120) return '#10B981';
  if (Math.abs(diff) < 300) return '#F59E0B';
  return '#EF4444';
};

// Simplified Woodford acorn mark for the brand strip
const WoodfordMark = ({ size = 24, color = WOODFORD.purple }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="46" stroke={color} strokeWidth="3" fill="none" />
    <ellipse cx="50" cy="42" rx="11" ry="14" fill={color} />
    <path d="M 39 30 Q 50 25 61 30 L 60 36 Q 50 33 40 36 Z" fill={color} opacity="0.6" />
    <path d="M 50 56 L 50 72" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <path d="M 30 60 Q 22 65 25 75 Q 35 72 40 65 Z M 70 60 Q 78 65 75 75 Q 65 72 60 65 Z" fill={color} opacity="0.5" />
  </svg>
);

export default function LiveMatch() {
  const [players, setPlayers] = useState(initialPlayers);
  const [half, setHalf] = useState(1);
  const [elapsed, setElapsed] = useState(19 * 60 + 23);
  const [running, setRunning] = useState(false);
  const [scoreUs, setScoreUs] = useState(3);
  const [scoreThem, setScoreThem] = useState(1);
  const [eventLog, setEventLog] = useState([
    { id: 1, type: 'TRY_US', label: 'Try — Smith', t: 4 * 60 + 12 },
    { id: 2, type: 'TRY_THEM', label: 'Try — Saints', t: 8 * 60 + 30 },
    { id: 3, type: 'TRY_US', label: 'Try — Khan', t: 11 * 60 + 5 },
    { id: 4, type: 'TRY_US', label: 'Try — Lewis', t: 16 * 60 + 48 },
  ]);
  const [subBuilderOpen, setSubBuilderOpen] = useState(false);
  const [comingOff, setComingOff] = useState([]);
  const [comingOn, setComingOn] = useState([]);
  const [tryPickerSide, setTryPickerSide] = useState(null);
  const [toast, setToast] = useState(null);
  const [showCoachNudge, setShowCoachNudge] = useState(true);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsed((e) => e + 1);
      setPlayers((ps) => ps.map((p) => p.status === 'on' ? { ...p, minutes: p.minutes + 1 } : p));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const onPitch = useMemo(() => players.filter(p => p.status === 'on').sort((a, b) => b.minutes - a.minutes), [players]);
  const bench = useMemo(() => players.filter(p => p.status === 'bench').sort((a, b) => a.minutes - b.minutes), [players]);
  const off = useMemo(() => players.filter(p => p.status === 'blood' || p.status === 'injured'), [players]);
  const avgMinutes = useMemo(() => {
    const active = players.filter(p => p.status !== 'injured');
    return active.reduce((s, p) => s + p.minutes, 0) / active.length;
  }, [players]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const togglePickOff = (p) => {
    if (comingOff.find(x => x.id === p.id)) {
      setComingOff(comingOff.filter(x => x.id !== p.id));
    } else if (comingOff.length < 3) {
      setComingOff([...comingOff, p]);
    } else {
      showToast('Max 3 subs at once');
    }
  };
  const togglePickOn = (p) => {
    if (comingOn.find(x => x.id === p.id)) {
      setComingOn(comingOn.filter(x => x.id !== p.id));
    } else if (comingOn.length < 3) {
      setComingOn([...comingOn, p]);
    } else {
      showToast('Max 3 subs at once');
    }
  };

  const pairings = useMemo(() => {
    const offCopy = [...comingOff];
    const onCopy = [...comingOn];
    const pairs = [];
    for (const off of offCopy) {
      const idx = onCopy.findIndex(on => on.eligible.includes(off.group));
      if (idx >= 0) {
        pairs.push({ off, on: onCopy[idx], match: true });
        onCopy.splice(idx, 1);
      } else {
        pairs.push({ off, on: null, match: false });
      }
    }
    for (const on of onCopy) pairs.push({ off: null, on, match: false });
    return pairs;
  }, [comingOff, comingOn]);

  const compositionCheck = useMemo(() => {
    if (comingOff.length === 0 && comingOn.length === 0) return { ok: true, message: '' };
    if (comingOff.length !== comingOn.length) {
      return { ok: false, message: `Pick ${comingOff.length > comingOn.length ? 'someone on' : 'someone off'}` };
    }
    const futureOnPitch = onPitch
      .filter(p => !comingOff.find(x => x.id === p.id))
      .concat(comingOn);
    const counts = { forward: 0, back: 0, scrumhalf: 0 };
    futureOnPitch.forEach(p => { counts[p.group]++; });
    if (counts.forward !== 5 || counts.back !== 5 || counts.scrumhalf !== 1) {
      return { ok: false, message: `Would result in ${counts.forward}F · ${counts.back}B · ${counts.scrumhalf}SH (need 5·5·1)` };
    }
    return { ok: true, message: '' };
  }, [comingOff, comingOn, onPitch]);

  const canConfirm = comingOff.length > 0 && compositionCheck.ok;

  const confirmSubs = () => {
    if (!canConfirm) return;
    const offIds = new Set(comingOff.map(p => p.id));
    const onIds = new Set(comingOn.map(p => p.id));
    setPlayers(players.map(p => {
      if (offIds.has(p.id)) return { ...p, status: 'bench' };
      if (onIds.has(p.id)) return { ...p, status: 'on' };
      return p;
    }));
    const labels = pairings
      .filter(pr => pr.off && pr.on)
      .map(pr => `${pr.off.name}↔${pr.on.name}`)
      .join(', ');
    setEventLog([...eventLog, { id: Date.now(), type: 'SUB_BATCH', label: `Subs: ${labels}`, t: elapsed }]);
    setComingOff([]);
    setComingOn([]);
    setSubBuilderOpen(false);
    showToast(`${comingOff.length} sub${comingOff.length > 1 ? 's' : ''} confirmed`);
  };

  const recordTry = (side, scorer) => {
    if (side === 'us') {
      setScoreUs(scoreUs + 1);
      if (scorer) {
        setPlayers(players.map(p => p.id === scorer.id ? { ...p, tries: p.tries + 1 } : p));
      }
      setEventLog([...eventLog, { id: Date.now(), type: 'TRY_US', label: scorer ? `Try — ${scorer.name}` : 'Try (unattributed)', t: elapsed }]);
    } else {
      setScoreThem(scoreThem + 1);
      setEventLog([...eventLog, { id: Date.now(), type: 'TRY_THEM', label: 'Try — Saints', t: elapsed }]);
    }
    setTryPickerSide(null);
  };

  const undo = () => {
    if (eventLog.length === 0) return;
    const last = eventLog[eventLog.length - 1];
    if (last.type === 'TRY_US') setScoreUs(s => Math.max(0, s - 1));
    if (last.type === 'TRY_THEM') setScoreThem(s => Math.max(0, s - 1));
    setEventLog(eventLog.slice(0, -1));
    showToast(`Undone: ${last.label}`);
  };

  const setStatus = (id, status) => {
    setPlayers(players.map(p => p.id === id ? { ...p, status } : p));
  };

  const openSubBuilder = () => {
    setSubBuilderOpen(true);
    setShowCoachNudge(false);
  };

  return (
    <div className="min-h-screen pb-44" style={{ background: '#F5F3F0', color: WOODFORD.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
        * { font-family: 'Inter', system-ui, sans-serif; }
        .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .tap-target { min-height: 56px; }
        @keyframes pulse-ready {
          0%, 100% { box-shadow: 0 0 0 0 rgba(120, 40, 128, 0.6); }
          50% { box-shadow: 0 0 0 10px rgba(120, 40, 128, 0); }
        }
        .pulse-ready { animation: pulse-ready 1.6s ease-out infinite; }
      `}</style>

      {/* Brand strip */}
      <div className="sticky top-0 z-20" style={{ background: WOODFORD.purple, color: 'white' }}>
        <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${WOODFORD.purpleDark}` }}>
          <div className="flex items-center gap-2">
            <WoodfordMark size={22} color="white" />
            <div className="leading-tight">
              <div className="text-[13px] font-bold tracking-wide uppercase">Woodford U12</div>
              <div className="text-[10px] opacity-80 tracking-wider">vs Saints · Team A</div>
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-widest opacity-70 italic">Nunquam Respice</div>
        </div>

        {/* Clock + score */}
        <div style={{ background: WOODFORD.ink }} className="px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest opacity-60">H{half}</span>
              <span className="mono text-3xl font-bold tabular-nums tracking-tight">{fmt(elapsed)}</span>
            </div>
            <button
              onClick={() => setRunning(!running)}
              className="tap-target w-14 rounded-lg flex items-center justify-center transition active:scale-95"
              style={{ background: running ? '#F59E0B' : '#10B981', color: WOODFORD.ink }}
              aria-label={running ? 'Pause' : 'Start'}
            >
              {running ? <Pause size={22} strokeWidth={2.5} /> : <Play size={22} strokeWidth={2.5} />}
            </button>
            <div className="flex-1 flex items-center gap-1.5 ml-1">
              <ScoreButton label="Us" value={scoreUs} primary onClick={() => setTryPickerSide('us')} />
              <span className="opacity-50">—</span>
              <ScoreButton label="Them" value={scoreThem} onClick={() => recordTry('them', null)} />
            </div>
          </div>
        </div>
      </div>

      {/* Coach nudge */}
      {showCoachNudge && !subBuilderOpen && (
        <div className="mx-3 mt-3 rounded-lg p-3 flex items-start gap-3" style={{ background: WOODFORD.purpleSofter, border: `1px solid ${WOODFORD.purpleSoft}` }}>
          <AlertTriangle size={18} style={{ color: WOODFORD.purple }} className="flex-shrink-0 mt-0.5" strokeWidth={2.5} />
          <div className="flex-1 text-sm">
            <div className="font-bold" style={{ color: WOODFORD.purpleDark }}>Suggested batch sub</div>
            <div style={{ color: WOODFORD.purple }} className="text-[13px]">O'Neill ↔ Taylor · Smith ↔ Patterson</div>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                setComingOff([players.find(p => p.name === "O'Neill"), players.find(p => p.name === 'Smith')]);
                setComingOn([players.find(p => p.name === 'Taylor'), players.find(p => p.name === 'Patterson')]);
                openSubBuilder();
              }}
              className="text-xs font-bold px-2.5 py-1 rounded"
              style={{ background: WOODFORD.purple, color: 'white' }}
            >
              Open
            </button>
            <button onClick={() => setShowCoachNudge(false)} className="text-xs px-2 py-1" style={{ color: WOODFORD.purple }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Sub builder helper bar */}
      {subBuilderOpen && (
        <div className="sticky z-10 px-3 py-2 shadow-md flex items-center justify-between" style={{ top: '92px', background: WOODFORD.purple, color: 'white' }}>
          <div className="text-xs font-bold uppercase tracking-wide">Sub builder · tap to pick</div>
          <button onClick={() => { setSubBuilderOpen(false); setComingOff([]); setComingOn([]); }} className="opacity-80">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Sections */}
      <div className="px-3 pt-3 space-y-4">
        <Section title="On pitch" count={onPitch.length} subtitle="most played first" hint={subBuilderOpen ? 'tap to take off' : null}>
          <div className="grid grid-cols-2 gap-2">
            {onPitch.map(p => (
              <PlayerCard
                key={p.id}
                player={p}
                avgMinutes={avgMinutes}
                picked={!!comingOff.find(x => x.id === p.id)}
                pickedTone="rose"
                onTap={subBuilderOpen ? () => togglePickOff(p) : undefined}
                showActions={!subBuilderOpen}
                onBlood={() => setStatus(p.id, 'blood')}
                onInjury={() => setStatus(p.id, 'injured')}
              />
            ))}
          </div>
        </Section>

        <Section title="Bench" count={bench.length} subtitle="least played first" hint={subBuilderOpen ? 'tap to bring on' : null}>
          <div className="grid grid-cols-2 gap-2">
            {bench.map(p => (
              <PlayerCard
                key={p.id}
                player={p}
                avgMinutes={avgMinutes}
                picked={!!comingOn.find(x => x.id === p.id)}
                pickedTone="emerald"
                onTap={subBuilderOpen ? () => togglePickOn(p) : undefined}
                showActions={false}
              />
            ))}
          </div>
        </Section>

        {off.length > 0 && (
          <Section title="Off" count={off.length} subtitle="blood / injured">
            <div className="grid grid-cols-2 gap-2">
              {off.map(p => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  avgMinutes={avgMinutes}
                  muted
                  showActions={false}
                  onReturn={() => setStatus(p.id, 'bench')}
                />
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Sub builder tray */}
      {subBuilderOpen && (
        <div className="fixed bottom-[76px] left-0 right-0 px-3 py-3 shadow-2xl z-30" style={{ background: WOODFORD.ink, color: 'white', borderTop: `2px solid ${WOODFORD.purple}` }}>
          {comingOff.length === 0 && comingOn.length === 0 ? (
            <div className="text-sm py-3 text-center italic opacity-60">
              Tap players above to build your subs
            </div>
          ) : (
            <div className="space-y-1.5 mb-3">
              {pairings.map((pr, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1">
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    {pr.off ? (
                      <>
                        <GroupBadge group={pr.off.group} size="sm" />
                        <span className="font-semibold truncate" style={{ color: '#FCA5A5' }}>{pr.off.name}</span>
                      </>
                    ) : (
                      <span className="opacity-50 italic text-xs">— pick someone off —</span>
                    )}
                  </div>
                  <ArrowRight size={14} className="opacity-40 flex-shrink-0" />
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    {pr.on ? (
                      <>
                        <GroupBadge group={pr.on.group} size="sm" />
                        <span className="font-semibold truncate" style={{ color: '#86EFAC' }}>{pr.on.name}</span>
                      </>
                    ) : (
                      <span className="opacity-50 italic text-xs">— pick someone on —</span>
                    )}
                  </div>
                  <div className="w-4 flex-shrink-0">
                    {pr.off && pr.on && (
                      pr.match
                        ? <Check size={16} style={{ color: '#10B981' }} strokeWidth={3} />
                        : <AlertTriangle size={16} style={{ color: '#F59E0B' }} strokeWidth={2.5} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!compositionCheck.ok && comingOff.length + comingOn.length > 0 && (
            <div className="text-xs rounded p-2 mb-2 flex items-start gap-2" style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#FCD34D' }}>
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{compositionCheck.message}</span>
            </div>
          )}
          <button
            onClick={confirmSubs}
            disabled={!canConfirm}
            className={`tap-target w-full rounded-lg font-bold text-lg active:scale-95 transition ${canConfirm ? 'pulse-ready' : 'cursor-not-allowed'}`}
            style={{
              background: canConfirm ? WOODFORD.purple : '#3F3F46',
              color: canConfirm ? 'white' : '#71717A',
            }}
          >
            {comingOff.length === 0
              ? 'Pick players to sub'
              : `Confirm ${comingOff.length} sub${comingOff.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 px-3 py-3 flex items-center gap-2 z-30" style={{ background: '#F5F3F0', borderTop: '1px solid #D6D3D1' }}>
        <button
          onClick={undo}
          disabled={eventLog.length === 0}
          className="tap-target px-4 rounded-lg border-2 font-semibold flex items-center gap-2 disabled:opacity-40 active:scale-95 transition"
          style={{ borderColor: '#D6D3D1', color: WOODFORD.ink }}
        >
          <Undo2 size={18} strokeWidth={2.5} />
          Undo
        </button>
        {!subBuilderOpen && (
          <button
            onClick={openSubBuilder}
            className="tap-target flex-1 rounded-lg font-bold text-lg active:scale-95 transition"
            style={{ background: WOODFORD.purple, color: 'white' }}
          >
            Build subs
          </button>
        )}
      </div>

      {/* Try scorer picker */}
      {tryPickerSide === 'us' && (
        <div className="fixed inset-0 z-40 flex items-end" style={{ background: 'rgba(32, 24, 32, 0.7)' }} onClick={() => setTryPickerSide(null)}>
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy size={22} style={{ color: WOODFORD.purple }} />
                <div className="text-2xl font-bold" style={{ color: WOODFORD.ink }}>Who scored?</div>
              </div>
              <button onClick={() => setTryPickerSide(null)} className="tap-target w-12 flex items-center justify-center"><X /></button>
            </div>
            <div className="space-y-1.5">
              {onPitch.map(p => (
                <button
                  key={p.id}
                  onClick={() => recordTry('us', p)}
                  className="tap-target w-full flex items-center gap-3 px-3 bg-white rounded-lg border active:scale-[0.98] transition"
                  style={{ borderColor: '#E7E5E4' }}
                >
                  <GroupBadge group={p.group} />
                  <span className="font-semibold flex-1 text-left">{p.name}</span>
                  {p.tries > 0 && <span className="mono text-xs opacity-60">{p.tries}T</span>}
                </button>
              ))}
              <button
                onClick={() => recordTry('us', null)}
                className="tap-target w-full px-3 italic active:scale-[0.98] transition opacity-70"
              >
                Unattributed / decide later
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm shadow-lg z-50" style={{ background: WOODFORD.ink, color: 'white' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function ScoreButton({ label, value, primary, onClick }) {
  return (
    <button
      onClick={onClick}
      className="tap-target flex-1 rounded-lg flex items-center justify-center gap-1.5 font-bold active:scale-95 transition"
      style={{
        background: primary ? 'white' : 'rgba(255,255,255,0.1)',
        color: primary ? WOODFORD.ink : 'white',
        border: primary ? 'none' : '1px solid rgba(255,255,255,0.2)',
      }}
    >
      <Plus size={14} strokeWidth={3} />
      <span className="text-sm uppercase tracking-wide">{label}</span>
      <span className="mono text-xl tabular-nums">{value}</span>
    </button>
  );
}

function GroupBadge({ group, size = 'md' }) {
  const isLarge = size === 'md';
  const bg = group === 'forward' ? WOODFORD.ink
    : group === 'back' ? WOODFORD.purple
    : WOODFORD.purpleDark;
  return (
    <span
      className={`font-bold rounded-full flex items-center justify-center flex-shrink-0 ${isLarge ? 'text-xs w-7 h-7' : 'text-[10px] w-5 h-5'}`}
      style={{ background: bg, color: 'white' }}
    >
      {groupLabel[group]}
    </span>
  );
}

function Section({ title, count, subtitle, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-bold" style={{ color: WOODFORD.ink }}>{title}</h2>
          <span className="mono text-sm opacity-50">({count})</span>
        </div>
        <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: hint ? WOODFORD.purple : '#A8A29E' }}>
          {hint || subtitle}
        </span>
      </div>
      {children}
    </div>
  );
}

function PlayerCard({ player, avgMinutes, picked, pickedTone, onTap, showActions, onBlood, onInjury, onReturn, muted }) {
  const pickedBg = pickedTone === 'rose' ? '#FEE2E2' : '#D1FAE5';
  const pickedBorder = pickedTone === 'rose' ? '#F87171' : '#34D399';

  return (
    <div
      onClick={onTap}
      className={`p-2.5 rounded-lg transition relative ${onTap ? 'active:scale-[0.98] cursor-pointer' : ''}`}
      style={{
        background: picked ? pickedBg : muted ? '#F5F5F4' : 'white',
        border: picked ? `2px solid ${pickedBorder}` : '1px solid #E7E5E4',
        opacity: muted ? 0.7 : 1,
        minHeight: '88px',
      }}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <GroupBadge group={player.group} />
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate text-[15px] leading-tight" style={{ color: WOODFORD.ink }}>
            {player.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: balanceColor(player.minutes, avgMinutes) }} />
            <span className="mono text-xs tabular-nums opacity-70">{fmt(player.minutes)}</span>
            {player.tries > 0 && (
              <span className="mono text-xs font-bold" style={{ color: WOODFORD.purple }}>{player.tries}T</span>
            )}
          </div>
        </div>
      </div>

      {showActions && (
        <div className="flex gap-1 mt-1.5">
          <MiniAction onClick={onBlood} color="#DC2626" icon={<Heart size={12} strokeWidth={2.5} />} label="Blood" />
          <MiniAction onClick={onInjury} color={WOODFORD.ink} label="Inj" />
        </div>
      )}
      {onReturn && (
        <button
          onClick={(e) => { e.stopPropagation(); onReturn(); }}
          className="w-full mt-1.5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wide flex items-center justify-center gap-1 active:scale-95"
          style={{ background: '#10B981', color: 'white' }}
        >
          <Activity size={12} strokeWidth={2.5} /> Return
        </button>
      )}
    </div>
  );
}

function MiniAction({ onClick, color, icon, label }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex-1 py-1.5 rounded text-[11px] font-bold uppercase tracking-wide flex items-center justify-center gap-1 active:scale-95 transition"
      style={{ background: color, color: 'white' }}
    >
      {icon}
      {label}
    </button>
  );
}
