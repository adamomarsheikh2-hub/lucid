import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'

// ─── Themes ───────────────────────────────────────────────────────────────────

const DARK = {
  bg: '#0a0b10', bgSub: '#0e0f15', surface: '#141520', surfaceHover: '#1a1b28',
  card: 'rgba(20,21,32,0.7)', cardSolid: '#141520', border: 'rgba(255,255,255,0.06)',
  borderHover: 'rgba(255,255,255,0.1)', text: '#e4e5ea', textSec: '#8b8d9a', muted: '#55576a',
  green: '#00d68f', greenDim: 'rgba(0,214,143,0.15)', greenBorder: 'rgba(0,214,143,0.25)',
  red: '#ff4d6a', redDim: 'rgba(255,77,106,0.15)', redBorder: 'rgba(255,77,106,0.25)',
  blue: '#636bff', blueDim: 'rgba(99,107,255,0.12)', accent: 'linear-gradient(135deg, #636bff, #9f6bff)',
  amber: '#ffb020', amberDim: 'rgba(255,176,32,0.12)',
  inputBg: 'rgba(255,255,255,0.04)', glow: '0 0 40px rgba(99,107,255,0.08)',
  pin: 'rgba(255,255,255,0.06)', pinText: '#e4e5ea',
}
const LIGHT = {
  bg: '#4a4135', bgSub: '#403729', surface: '#574b3c', surfaceHover: '#5f5341',
  card: 'rgba(87,75,60,0.85)', cardSolid: '#574b3c', border: 'rgba(220,200,160,0.12)',
  borderHover: 'rgba(220,200,160,0.22)', text: '#e6d8b0', textSec: '#b3a37e', muted: '#7d7058',
  green: '#7cc190', greenDim: 'rgba(124,193,144,0.14)', greenBorder: 'rgba(124,193,144,0.28)',
  red: '#e08878', redDim: 'rgba(224,136,120,0.14)', redBorder: 'rgba(224,136,120,0.28)',
  blue: '#a89cdc', blueDim: 'rgba(168,156,220,0.14)', accent: 'linear-gradient(135deg, #a89cdc, #c39cdc)',
  amber: '#e0b070', amberDim: 'rgba(224,176,112,0.14)',
  inputBg: 'rgba(220,200,160,0.06)', glow: '0 0 40px rgba(168,156,220,0.07)',
  pin: 'rgba(220,200,160,0.08)', pinText: '#e6d8b0',
}

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const TARGET = 3000
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
const fmt = v => (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })

const GlassCard = ({ children, style, t, glow }) => (
  <div style={{
    background: t.card, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${t.border}`, borderRadius: 16,
    padding: '20px', transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: glow ? t.glow : 'none', ...style,
  }}>{children}</div>
)

function GradientBar({ value, max, gradient, height = 6, t }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div style={{ borderRadius: 99, height, overflow: 'hidden', background: t.inputBg }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: gradient, transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
    </div>
  )
}

function ArcGauge({ pct, color, size = 120, t }) {
  const r = (size - 12) / 2
  const cx = size / 2
  const cy = size / 2
  const circum = Math.PI * r
  const offset = circum - (Math.min(pct, 100) / 100) * circum
  return (
    <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`}>
      <path d={`M 6 ${cy} A ${r} ${r} 0 0 1 ${size - 6} ${cy}`}
        fill="none" stroke={t.inputBg} strokeWidth="8" strokeLinecap="round" />
      <path d={`M 6 ${cy} A ${r} ${r} 0 0 1 ${size - 6} ${cy}`}
        fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={circum} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
      {/* 50% limit marker */}
      <circle cx={cx} cy={6} r="3.5" fill={t.muted} opacity="0.6" />
    </svg>
  )
}

function StatusBadge({ text, color, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      letterSpacing: 0.5, background: bg, color,
      border: `1px solid ${color}22`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      {text}
    </span>
  )
}

function ChartTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value ?? 0
  return (
    <div style={{
      background: t.cardSolid, border: `1px solid ${t.border}`, borderRadius: 12,
      padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ fontSize: 11, color: t.muted, marginBottom: 3, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: v >= 0 ? t.green : t.red, letterSpacing: -0.3 }}>
        {v >= 0 ? '+' : ''}{fmt(v)}
      </div>
    </div>
  )
}

// ─── Contract Size Calculator ─────────────────────────────────────────────────

const INSTRUMENTS = [
  { id: 'ES',  label: 'ES',  name: 'S&P 500',     mini: 50,   micro: 5,    miniLabel: 'ES',  microLabel: 'MES' },
  { id: 'NQ',  label: 'NQ',  name: 'Nasdaq',       mini: 20,   micro: 2,    miniLabel: 'NQ',  microLabel: 'MNQ' },
  { id: 'YM',  label: 'YM',  name: 'Dow Jones',    mini: 5,    micro: 0.5,  miniLabel: 'YM',  microLabel: 'MYM' },
  { id: 'RTY', label: 'RTY', name: 'Russell 2000',  mini: 50,   micro: 5,    miniLabel: 'RTY', microLabel: 'M2K' },
  { id: 'CL',  label: 'CL',  name: 'Crude Oil',    mini: 1000, micro: 100,  miniLabel: 'CL',  microLabel: 'MCL' },
  { id: 'GC',  label: 'GC',  name: 'Gold',         mini: 100,  micro: 10,   miniLabel: 'GC',  microLabel: 'MGC' },
  { id: '6E',  label: '6E',  name: 'Euro FX',      mini: 12.5, micro: 1.25, miniLabel: '6E', microLabel: 'M6E' },
]

function ContractCalc({ t, inp }) {
  const [instrument, setInstrument] = useState('NQ')
  const [sl, setSl] = useState('')
  const [risk, setRisk] = useState('')

  const inst = INSTRUMENTS.find(i => i.id === instrument)
  const slNum = parseFloat(sl)
  const riskNum = parseFloat(risk)
  const valid = slNum > 0 && riskNum > 0 && inst

  const miniContracts = valid ? Math.max(1, Math.round(riskNum / (slNum * inst.mini))) : 0
  const microContracts = valid ? Math.max(1, Math.round(riskNum / (slNum * inst.micro))) : 0
  const miniActualRisk = valid ? miniContracts * slNum * inst.mini : 0
  const microActualRisk = valid ? microContracts * slNum * inst.micro : 0

  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: '20px', background: t.bg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Size Calculator</span>
        <span style={{ fontSize: 11, color: t.muted }}>{inst.miniLabel} · ${inst.mini.toLocaleString()}/pt</span>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {INSTRUMENTS.map(i => (
          <button key={i.id} onClick={() => setInstrument(i.id)} style={{
            padding: '5px 11px', borderRadius: 6, border: 'none',
            background: instrument === i.id ? 'rgba(99,107,255,0.12)' : 'transparent',
            color: instrument === i.id ? t.blue : t.muted,
            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
          }}>{i.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <input style={{ ...inp, fontSize: 13, padding: '9px 11px' }} type="number" placeholder="SL points" value={sl} onChange={e => setSl(e.target.value)} />
        <input style={{ ...inp, fontSize: 13, padding: '9px 11px' }} type="number" placeholder="Risk $" value={risk} onChange={e => setRisk(e.target.value)} />
      </div>

      {valid ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: t.border, border: `1px solid ${t.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: t.bg, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: t.muted, marginBottom: 4, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>Mini · {inst.miniLabel}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: t.blue, letterSpacing: -0.6 }}>{miniContracts}</span>
                <span style={{ fontSize: 11, color: t.muted }}>= ${miniActualRisk.toFixed(0)} risk</span>
              </div>
            </div>
            <div style={{ background: t.bg, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: t.muted, marginBottom: 4, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>Micro · {inst.microLabel}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: t.green, letterSpacing: -0.6 }}>{microContracts}</span>
                <span style={{ fontSize: 11, color: t.muted }}>= ${microActualRisk.toFixed(0)} risk</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: t.muted }}>Enter SL and risk to calculate</div>
      )}
    </div>
  )
}

// ─── Welcome / Passcode Screen ───────────────────────────────────────────────

function PasscodeScreen({ users, onAuth, t }) {
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (selected && inputRef.current) inputRef.current.focus()
  }, [selected])

  const verify = async (code) => {
    setVerifying(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.id, passcode: code }),
      })
      if (res.ok) { onAuth(await res.json()) }
      else {
        setShake(true); setError(true); setPin('')
        setTimeout(() => setShake(false), 500)
        setTimeout(() => setError(false), 2000)
      }
    } catch { setPin('') }
    setVerifying(false)
  }

  const handleInput = val => {
    const clean = val.replace(/\D/g, '').slice(0, 4)
    setPin(clean)
    if (error) setError(false)
    if (clean.length === 4) verify(clean)
  }

  const back = () => { setSelected(null); setPin(''); setError(false) }

  // Shared page wrapper
  const Page = ({ children }) => (
    <div style={{
      background: t.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 24,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)', width: '80vw', height: '60vh', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(99,107,255,0.07), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', left: '20%', width: '40vw', height: '40vh', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(159,107,255,0.04), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
      <style>{`
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
      `}</style>
    </div>
  )

  // ── User selection screen ──
  if (!selected) return (
    <Page>
      {/* Logo */}
      <div style={{
        width: 48, height: 48, borderRadius: 14, background: t.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, boxShadow: '0 4px 24px rgba(99,107,255,0.25)',
      }}>
        <span style={{ color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: 0.5 }}>LF</span>
      </div>

      <div style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: -1, marginBottom: 4, textAlign: 'center' }}>Welcome back</div>
      <div style={{ fontSize: 14, color: t.textSec, marginBottom: 40, textAlign: 'center' }}>Select your account to continue</div>

      <div style={{ display: 'flex', gap: 14, width: '100%', justifyContent: 'center' }}>
        {users.map((u, idx) => (
          <button key={u.id} onClick={() => setSelected(u)} style={{
            flex: '0 1 180px', padding: '32px 20px', borderRadius: 20,
            border: `1px solid ${t.border}`, background: t.card,
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            cursor: 'pointer', textAlign: 'center',
            transition: 'all 0.2s ease',
            animation: `fadeUp 0.4s ease ${idx * 0.08}s both`,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#636bff44'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,107,255,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: t.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', fontSize: 24, fontWeight: 800, color: '#fff',
              boxShadow: '0 4px 16px rgba(99,107,255,0.3)',
            }}>{u.name[0].toUpperCase()}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>{u.name}</div>
            <div style={{ fontSize: 12, color: t.muted }}>$50K Evaluation</div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: t.green, boxShadow: `0 0 8px ${t.green}` }} />
        <span style={{ fontSize: 12, color: t.muted }}>LucidFlex $50K · Evaluation Tracker</span>
      </div>
    </Page>
  )

  // ── PIN entry screen ──
  return (
    <Page>
      <button onClick={back} style={{
        alignSelf: 'flex-start', background: 'none', border: 'none',
        color: t.textSec, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
        marginBottom: 32, padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6,
        transition: 'color 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.color = t.text}
        onMouseLeave={e => e.currentTarget.style.color = t.textSec}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> Back
      </button>

      <div style={{ animation: 'fadeUp 0.3s ease both' }}>
        {/* Avatar */}
        <div style={{
          width: 64, height: 64, borderRadius: 20, background: t.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 28, fontWeight: 800, color: '#fff',
          boxShadow: '0 6px 24px rgba(99,107,255,0.3)',
        }}>{selected.name[0].toUpperCase()}</div>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: -0.5, marginBottom: 4 }}>{selected.name}</div>
          <div style={{ fontSize: 13, color: t.textSec }}>Enter your 4-digit passcode</div>
        </div>

        {/* Hidden real input for keyboard capture */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          value={pin}
          onChange={e => handleInput(e.target.value)}
          maxLength={4}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
          autoFocus
        />

        {/* Visual PIN boxes */}
        <div
          onClick={() => inputRef.current?.focus()}
          style={{
            display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24,
            animation: shake ? 'shake 0.4s ease' : 'none', cursor: 'text',
          }}
        >
          {[0,1,2,3].map(i => {
            const filled = i < pin.length
            const active = i === pin.length && !error
            return (
              <div key={i} style={{
                width: 56, height: 64, borderRadius: 14, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: filled ? (error ? t.redDim : t.blueDim) : t.inputBg,
                border: `2px solid ${error && filled ? t.red : active ? '#636bff' : filled ? '#636bff44' : t.border}`,
                transition: 'all 0.15s ease',
                boxShadow: active ? '0 0 0 4px rgba(99,107,255,0.1)' : filled && !error ? '0 0 12px rgba(99,107,255,0.08)' : 'none',
              }}>
                {filled ? (
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: error ? t.red : '#636bff',
                    boxShadow: error ? `0 0 8px ${t.red}` : '0 0 8px rgba(99,107,255,0.4)',
                    transition: 'all 0.1s',
                  }} />
                ) : active ? (
                  <div style={{
                    width: 2, height: 24, borderRadius: 1, background: '#636bff',
                    animation: 'pulse 1s ease infinite',
                  }} />
                ) : null}
              </div>
            )
          })}
        </div>

        {/* Error message */}
        <div style={{ textAlign: 'center', height: 20, marginBottom: 20 }}>
          {error && (
            <span style={{ fontSize: 13, color: t.red, fontWeight: 600, animation: 'fadeUp 0.2s ease' }}>
              Wrong passcode — try again
            </span>
          )}
          {verifying && !error && (
            <span style={{ fontSize: 13, color: t.muted }}>Verifying…</span>
          )}
        </div>

        {/* Numpad — compact, for mobile or preference */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 260, margin: '0 auto' }}>
          {[1,2,3,4,5,6,7,8,9,null,0,'del'].map((d, i) => {
            if (d === null) return <div key={i} />
            const isDel = d === 'del'
            return (
              <button key={i}
                onClick={() => {
                  if (isDel) { setPin(p => p.slice(0,-1)); if (error) setError(false) }
                  else handleInput(pin + String(d))
                  inputRef.current?.focus()
                }}
                style={{
                  height: 52, borderRadius: 12,
                  border: `1px solid ${t.border}`,
                  background: t.inputBg,
                  color: isDel ? t.textSec : t.text,
                  fontSize: isDel ? 13 : 20, fontWeight: isDel ? 600 : 500,
                  cursor: 'pointer', fontFamily: FONT,
                  transition: 'all 0.1s',
                  userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                }}
                onMouseDown={e => { e.currentTarget.style.background = t.borderHover; e.currentTarget.style.transform = 'scale(0.96)' }}
                onMouseUp={e => { e.currentTarget.style.background = t.inputBg; e.currentTarget.style.transform = 'scale(1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = t.inputBg; e.currentTarget.style.transform = 'scale(1)' }}
              >{isDel ? '⌫' : d}</button>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: t.muted }}>
          Type on keyboard or tap the pad
        </div>
      </div>
    </Page>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ user, allUsers, onSwitch, dark, setDark, t }) {
  const [days, setDays] = useState([])
  const [balance, setBalance] = useState('50000')
  const [pnlInput, setPnlInput] = useState('')
  const [labelInput, setLabelInput] = useState('')
  const [dateInput, setDateInput] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [overrideActive, setOverrideActive] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    fetch(`/api/data/${user.id}`).then(r => r.json()).then(d => {
      setDays(d.days || []); setBalance(d.balance || '50000')
      if (d.balance && d.balance !== '50000') setOverrideActive(true)
      setLoaded(true)
    })
  }, [user.id])

  const save = useCallback((d, b) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch(`/api/data/${user.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: d, balance: b }) })
    }, 600)
  }, [user.id])

  const setDaysSave = fn => setDays(prev => { const next = fn(prev); save(next, balance); return next })
  const setBalanceSave = v => { setBalance(v); setOverrideActive(v !== '' && v !== '50000'); save(days, v) }
  const resetData = () => { setDays([]); setBalance('50000'); setOverrideActive(false); setConfirmReset(false); fetch(`/api/data/${user.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: [], balance: '50000' }) }) }

  const totalPnl = useMemo(() => days.reduce((s, d) => s + d.pnl, 0), [days])
  const bestTrade = useMemo(() => { const pos = days.filter(d => d.pnl > 0); return pos.length > 0 ? Math.max(...pos.map(d => d.pnl)) : 0 }, [days])

  // ── Group trades by date for consistency ──
  const dailyGroups = useMemo(() => {
    const map = {}
    days.forEach((d, i) => {
      const key = d.date || 'undated'
      if (!map[key]) map[key] = { date: key, trades: [], total: 0 }
      map[key].trades.push({ ...d, _idx: i })
      map[key].total += d.pnl
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [days])

  const tradingDays = dailyGroups.filter(g => g.date !== 'undated').length
  const bestDayTotal = useMemo(() => {
    const positives = dailyGroups.filter(g => g.total > 0)
    return positives.length > 0 ? Math.max(...positives.map(g => g.total)) : 0
  }, [dailyGroups])
  const bestDayDate = useMemo(() => {
    const g = dailyGroups.find(g => g.total === bestDayTotal && g.total > 0)
    return g ? g.date : null
  }, [dailyGroups, bestDayTotal])

  // Consistency uses DAILY totals, not individual trades
  const conPct = totalPnl > 0 && bestDayTotal > 0 ? (bestDayTotal / totalPnl) * 100 : 0
  const passing = conPct <= 50 && totalPnl > 0
  const failing = totalPnl > 0 && conPct > 50
  const neededMore = failing ? Math.ceil(bestDayTotal * 2 - totalPnl) : 0
  const maxBestDay = totalPnl > 0 ? Math.floor(totalPnl * 0.5) : 0
  const toTarget = Math.max(0, TARGET - totalPnl)
  const progressPct = Math.min(100, Math.max(0, (totalPnl / TARGET) * 100))
  const computedBalance = 50000 + totalPnl

  // ── Trailing MLL (EOD high watermark) ──
  const START_BAL = 50000
  const MLL_AMOUNT = 2000
  const ITB = START_BAL + TARGET // $53,000 — trailing locks here

  const { highWaterMark, mllFloor, mllBuffer, mllLocked } = useMemo(() => {
    // Compute EOD balances from daily groups in chronological order
    let hwm = START_BAL
    let runningBal = START_BAL
    const sorted = [...dailyGroups].sort((a, b) => a.date.localeCompare(b.date))
    for (const g of sorted) {
      runningBal += g.total
      if (runningBal > hwm) hwm = runningBal
    }
    const locked = hwm >= ITB
    const floor = locked ? ITB - MLL_AMOUNT : hwm - MLL_AMOUNT
    const currentBal = overrideActive ? (parseFloat(balance) || computedBalance) : computedBalance
    const buffer = currentBal - floor
    return { highWaterMark: hwm, mllFloor: floor, mllBuffer: Math.max(0, buffer), mllLocked: locked }
  }, [dailyGroups, computedBalance, overrideActive, balance])

  const mllPct = MLL_AMOUNT > 0 ? Math.min(100, Math.max(0, (mllBuffer / MLL_AMOUNT) * 100)) : 100
  const chartData = useMemo(() => { let cum = 0; return days.map((d, i) => { cum += d.pnl; return { name: d.label || `#${i+1}`, cumulative: parseFloat(cum.toFixed(2)) } }) }, [days])
  const addTrade = () => {
    const v = parseFloat(pnlInput); if (isNaN(v)) return
    const tradeDate = dateInput || new Date().toISOString().split('T')[0]
    setDaysSave(prev => [...prev, { pnl: v, label: labelInput.trim(), date: tradeDate }])
    setPnlInput(''); setLabelInput(''); setDateInput('')
  }

  // ── Performance Metrics ──
  const metrics = useMemo(() => {
    if (days.length === 0) return null
    const wins = days.filter(d => d.pnl > 0)
    const losses = days.filter(d => d.pnl < 0)
    const winRate = (wins.length / days.length) * 100
    const avgWin = wins.length > 0 ? wins.reduce((s, d) => s + d.pnl, 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, d) => s + d.pnl, 0) / losses.length) : 0
    const profitFactor = avgLoss > 0 && wins.length > 0 ? (wins.reduce((s, d) => s + d.pnl, 0)) / Math.abs(losses.reduce((s, d) => s + d.pnl, 0)) : wins.length > 0 ? Infinity : 0
    const expectancy = days.length > 0 ? totalPnl / days.length : 0
    const worstTrade = days.length > 0 ? Math.min(...days.map(d => d.pnl)) : 0
    let peak = 0, maxDD = 0, cum = 0
    for (const d of days) { cum += d.pnl; if (cum > peak) peak = cum; const dd = peak - cum; if (dd > maxDD) maxDD = dd }
    let streak = 0, streakType = null
    for (let i = days.length - 1; i >= 0; i--) {
      const w = days[i].pnl > 0
      if (streakType === null) { streakType = w; streak = 1 }
      else if (w === streakType) streak++
      else break
    }
    const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0
    return { winRate, avgWin, avgLoss, profitFactor, expectancy, worstTrade, maxDD, streak, streakType, avgRR, wins: wins.length, losses: losses.length }
  }, [days, totalPnl])

  const accountStatus = totalPnl >= TARGET && passing ? 'READY TO PASS' : failing ? 'FIX CONSISTENCY' : mllPct < 25 ? 'AT RISK' : 'IN PROGRESS'
  const statusColor = accountStatus === 'READY TO PASS' ? t.green : accountStatus === 'FIX CONSISTENCY' || accountStatus === 'AT RISK' ? t.red : t.blue
  const statusBg = accountStatus === 'READY TO PASS' ? t.greenDim : accountStatus === 'FIX CONSISTENCY' || accountStatus === 'AT RISK' ? t.redDim : t.blueDim

  const inp = { padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.border}`, fontSize: 14, color: t.text, background: t.inputBg, outline: 'none', fontFamily: FONT, boxSizing: 'border-box', transition: 'border-color 0.15s' }

  const conColor = failing ? t.red : passing ? t.green : t.blue

  if (!loaded) return (
    <div style={{ background: t.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ color: t.muted, fontSize: 14 }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ background: t.bg, minHeight: '100vh', fontFamily: FONT, color: t.text, padding: '0 0 60px', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: `1px solid ${t.border}`,
        background: dark ? 'rgba(10,11,16,0.85)' : 'rgba(74,65,53,0.85)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>L</div>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>LucidFlex <span style={{ color: t.muted, fontWeight: 500 }}>· $50K</span></span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {allUsers.map(u => (
            <button key={u.id} onClick={() => onSwitch(u)} style={{
              padding: '4px 10px', borderRadius: 6,
              border: 'none', background: u.id === user.id ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: u.id === user.id ? t.text : t.muted, fontWeight: 500, fontSize: 12,
              cursor: 'pointer', fontFamily: FONT,
            }}>{u.name}</button>
          ))}
          <div style={{ width: 1, height: 16, background: t.border, margin: '0 6px' }} />
          <button onClick={() => setDark(d => !d)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: t.muted, fontSize: 13, cursor: 'pointer' }}>{dark ? '☀' : '☾'}</button>
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: 'none', background: 'transparent', color: t.muted, fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>Reset</button>
          ) : (
            <>
              <button onClick={resetData} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: 'none', background: t.redDim, color: t.red, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Confirm</button>
              <button onClick={() => setConfirmReset(false)} style={{ height: 28, padding: '0 8px', borderRadius: 6, border: 'none', background: 'transparent', color: t.muted, fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
            </>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 0' }}>

        {/* ── Hero Row: Balance + Δ + Target progress + Override ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, marginBottom: 6 }}>Account Balance</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.6, lineHeight: 1 }}>
                  ${(overrideActive ? (parseFloat(balance) || computedBalance) : computedBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: totalPnl >= 0 ? t.green : t.red }}>
                  {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: t.muted }}>Override:</span>
              <input style={{ ...inp, width: 100, fontSize: 12, padding: '6px 10px', borderRadius: 6 }} type="number" placeholder="auto" value={overrideActive ? balance : ''} onChange={e => setBalanceSave(e.target.value)} />
              {overrideActive && <button onClick={() => { setOverrideActive(false); setBalance('50000'); save(days, '50000') }} style={{ background: 'none', border: 'none', color: t.muted, fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>×</button>}
            </div>
          </div>
          {/* Target progress bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: t.muted, fontWeight: 500 }}>
                Target progress · <span style={{ color: t.text, fontWeight: 600 }}>{Math.round(progressPct)}%</span>
              </span>
              <span style={{ fontSize: 11, color: t.muted }}>
                {totalPnl >= TARGET ? <span style={{ color: t.green, fontWeight: 600 }}>Target hit ✓</span> : <span>{fmt(toTarget)} to <span style={{ color: t.text, fontWeight: 600 }}>$3,000</span></span>}
              </span>
            </div>
            <div style={{ height: 4, background: t.inputBg, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: totalPnl >= TARGET ? t.green : t.accent, transition: 'width 0.5s' }} />
            </div>
          </div>
        </div>

        {/* ── Consistency + MLL detail (compact, side-by-side) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1, background: t.border, border: `1px solid ${t.border}`, borderRadius: 12, marginBottom: 24, overflow: 'hidden' }}>

          <div style={{ background: t.bg, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Consistency</span>
              <span style={{ fontSize: 11, color: failing ? t.red : passing ? t.green : t.muted, fontWeight: 600 }}>
                {totalPnl <= 0 ? '—' : failing ? 'FAILING' : 'PASSING'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: conColor, letterSpacing: -0.6 }}>
                {totalPnl > 0 ? `${conPct.toFixed(1)}%` : '—'}
              </span>
              <span style={{ fontSize: 12, color: t.muted }}>of 50% cap</span>
            </div>
            <div style={{ position: 'relative', height: 4, background: t.inputBg, borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: t.muted, opacity: 0.5, zIndex: 1 }} />
              <div style={{ width: `${Math.min(100, conPct)}%`, height: '100%', background: conColor, transition: 'width 0.5s' }} />
            </div>
            {failing && (
              <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.5 }}>
                Earn <span style={{ color: t.red, fontWeight: 600 }}>{fmt(neededMore)}</span> more across other days. Cap each day at <span style={{ color: t.text, fontWeight: 600 }}>{fmt(bestDayTotal)}</span>.
              </div>
            )}
            {passing && (
              <div style={{ fontSize: 12, color: t.muted }}>
                Max single day: <span style={{ color: t.text, fontWeight: 600 }}>{fmt(maxBestDay)}</span>
              </div>
            )}
            {totalPnl <= 0 && <div style={{ fontSize: 12, color: t.muted }}>Log trades to track</div>}
          </div>

          <div style={{ background: t.bg, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Max Loss Limit</span>
              <span style={{ fontSize: 11, color: mllPct < 25 ? t.red : mllPct < 50 ? t.amber : t.green, fontWeight: 600 }}>
                {mllPct < 25 ? 'DANGER' : mllPct < 50 ? 'CAUTION' : 'SAFE'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: mllPct < 25 ? t.red : mllPct < 50 ? t.amber : t.green, letterSpacing: -0.6 }}>
                {fmt(mllBuffer)}
              </span>
              <span style={{ fontSize: 12, color: t.muted }}>buffer</span>
            </div>
            <div style={{ position: 'relative', height: 4, background: t.inputBg, borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ width: `${mllPct}%`, height: '100%', background: mllPct < 25 ? t.red : mllPct < 50 ? t.amber : t.green, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 12, color: t.muted, display: 'flex', justifyContent: 'space-between' }}>
              <span>Floor <span style={{ color: t.text, fontWeight: 600 }}>${mllFloor.toLocaleString()}</span></span>
              <span>Peak <span style={{ color: t.text, fontWeight: 600 }}>${highWaterMark.toLocaleString()}</span></span>
            </div>
          </div>
        </div>

        {/* ── Equity Curve + Stats panel side-by-side ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(220px, 1fr)', gap: 14, marginBottom: 24 }}>

          {/* Chart */}
          <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: '20px', background: t.bg, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Equity Curve</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
                  Last: <span style={{ color: totalPnl >= 0 ? t.green : t.red, fontWeight: 600 }}>{totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}</span>
                  <span style={{ margin: '0 8px', color: t.border }}>·</span>
                  Peak: <span style={{ color: t.text, fontWeight: 600 }}>{fmt(Math.max(0, ...chartData.map(d => d.cumulative)))}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: t.muted }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 2, background: t.blue, borderRadius: 1, display: 'inline-block' }} />
                  Equity
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, borderTop: `1.5px dashed ${t.green}`, display: 'inline-block' }} />
                  Target
                </span>
              </div>
            </div>
            {chartData.length < 2 ? (
              <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: t.muted }}>Add 2+ trades to see the curve</div>
            ) : (
              <div style={{ height: 260, marginTop: 14, marginLeft: -8, marginRight: -8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 16, right: 24, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="cgPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={t.blue} stopOpacity={0.35} />
                        <stop offset="60%" stopColor={t.blue} stopOpacity={0.08} />
                        <stop offset="100%" stopColor={t.blue} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="cgStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={t.blue} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={t.blue} />
                      </linearGradient>
                      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke={t.border} vertical={false} strokeOpacity={0.6} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: t.muted, fontFamily: FONT }}
                      axisLine={false}
                      tickLine={false}
                      dy={6}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: t.muted, fontFamily: FONT }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : v <= -1000 ? `-$${Math.abs(v/1000).toFixed(1)}k` : `$${v}`}
                      width={46}
                      dx={-4}
                    />
                    <Tooltip content={<ChartTooltip t={t} />} cursor={{ stroke: t.muted, strokeWidth: 1, strokeDasharray: '3 3', strokeOpacity: 0.4 }} />
                    <ReferenceLine y={TARGET} stroke={t.green} strokeDasharray="5 5" strokeWidth={1.2} strokeOpacity={0.7} label={{ value: '$3k', position: 'right', fill: t.green, fontSize: 10, fontWeight: 600, offset: 6 }} />
                    <ReferenceLine y={0} stroke={t.border} strokeWidth={1} />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke="url(#cgStroke)"
                      strokeWidth={2.5}
                      fill="url(#cgPos)"
                      dot={{ fill: t.bg, stroke: t.blue, strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 6, fill: t.blue, stroke: t.bg, strokeWidth: 2, filter: 'url(#glow)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Stats Panel */}
          <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, background: t.bg, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Stats</span>
            </div>
            {!metrics ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', fontSize: 12, color: t.muted, textAlign: 'center' }}>
                Log trades to see stats
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {[
                  { l: 'Win rate', v: `${metrics.winRate.toFixed(0)}%`, sub: `${metrics.wins}W / ${metrics.losses}L`, c: metrics.winRate >= 50 ? t.green : t.red },
                  { l: 'Profit factor', v: metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2), sub: 'gross win ÷ loss', c: metrics.profitFactor >= 1.5 ? t.green : metrics.profitFactor >= 1 ? t.amber : t.red },
                  { l: 'Avg R:R', v: metrics.avgRR > 0 ? metrics.avgRR.toFixed(2) : '—', sub: 'avg win ÷ avg loss', c: metrics.avgRR >= 1.5 ? t.green : metrics.avgRR >= 1 ? t.text : t.red },
                  { l: 'Expectancy', v: (metrics.expectancy >= 0 ? '+' : '') + fmt(metrics.expectancy), sub: 'per trade', c: metrics.expectancy >= 0 ? t.green : t.red },
                  { l: 'Max drawdown', v: fmt(metrics.maxDD), sub: 'peak to trough', c: metrics.maxDD > 1000 ? t.red : metrics.maxDD > 500 ? t.amber : t.text },
                  { l: 'Best / Worst', v: `+${fmt(bestTrade)} / ${fmt(metrics.worstTrade)}`, sub: 'single trade', c: t.text, small: true },
                  { l: 'Streak', v: `${metrics.streak}${metrics.streakType ? 'W' : 'L'}`, sub: 'current run', c: metrics.streakType ? t.green : t.red },
                ].map((s, i) => (
                  <div key={i} style={{ padding: '12px 18px', borderBottom: i < 6 ? `1px solid ${t.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: t.text, fontWeight: 500 }}>{s.l}</div>
                      <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>{s.sub}</div>
                    </div>
                    <span style={{ fontSize: s.small ? 12 : 15, fontWeight: 700, color: s.c, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2, whiteSpace: 'nowrap' }}>{s.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── Trade Log + Calc ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>

          {/* Trade Log */}
          <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: '20px', background: t.bg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Trade Log</span>
              <span style={{ fontSize: 11, color: t.muted }}>{days.length} trades · {tradingDays} days</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              <input style={{ ...inp, flex: '1 1 120px', fontSize: 12, padding: '8px 10px', minWidth: 0 }} placeholder="e.g. NQ long" value={labelInput} onChange={e => setLabelInput(e.target.value)} />
              <input style={{ ...inp, width: 80, fontSize: 12, padding: '8px 10px' }} placeholder="$" type="number" value={pnlInput} onChange={e => setPnlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTrade()} />
              <input style={{ ...inp, width: 120, fontSize: 11, padding: '8px 10px' }} type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} />
              <button onClick={addTrade} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: t.accent, color: '#fff', fontWeight: 600, fontSize: 12, fontFamily: FONT }}>Add</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 320, overflowY: 'auto' }}>
              {days.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: t.muted }}>No trades yet</div>
              ) : (
                [...dailyGroups].reverse().map(group => {
                  const isBestDay = group.date === bestDayDate && bestDayTotal > 0
                  const d = group.date !== 'undated' ? new Date(group.date + 'T12:00:00') : null
                  const dayLabel = d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Undated'
                  return (
                    <div key={group.date} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${t.border}`, marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isBestDay && <span style={{ fontSize: 9, fontWeight: 700, color: t.amber, letterSpacing: 0.5 }}>★ BEST</span>}
                          <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{dayLabel}</span>
                          <span style={{ fontSize: 10, color: t.muted }}>{group.trades.length}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: group.total >= 0 ? t.green : t.red, fontVariantNumeric: 'tabular-nums' }}>
                          {group.total >= 0 ? '+' : ''}{fmt(group.total)}
                        </span>
                      </div>
                      {group.trades.map(td => (
                        <div key={td._idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: 4 }}>
                          <span style={{ fontSize: 12, color: t.textSec }}>{td.label || 'Trade'}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: td.pnl >= 0 ? t.green : t.red, fontVariantNumeric: 'tabular-nums' }}>{td.pnl >= 0 ? '+' : ''}{fmt(td.pnl)}</span>
                            <button onClick={() => setDaysSave(p => p.filter((_,j) => j !== td._idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 13, padding: 0, lineHeight: 1, opacity: 0.4 }}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = t.red }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.color = t.muted }}
                            >×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Calc */}
          <ContractCalc t={t} inp={inp} />
        </div>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(() => { const v = localStorage.getItem('lf-dark'); return v === null ? false : v === '1' })
  const [users, setUsers] = useState([])
  const [auth, setAuth] = useState(() => { try { return JSON.parse(localStorage.getItem('lf-auth')) } catch { return null } })
  const [switchTarget, setSwitchTarget] = useState(null)
  const t = dark ? DARK : LIGHT

  useEffect(() => { localStorage.setItem('lf-dark', dark ? '1' : '0') }, [dark])
  useEffect(() => { fetch('/api/users').then(r => r.json()).then(setUsers) }, [])

  const handleAuth = (data) => { const a = { id: data.id, name: data.name }; setAuth(a); setSwitchTarget(null); localStorage.setItem('lf-auth', JSON.stringify(a)) }
  const handleSwitch = (user) => { if (user.id === auth?.id) return; setSwitchTarget(user); setAuth(null); localStorage.removeItem('lf-auth') }

  if (users.length === 0) return <div style={{ background: t.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}><div style={{ color: t.muted }}>Loading…</div></div>
  if (!auth) return <PasscodeScreen users={switchTarget ? [switchTarget] : users} onAuth={handleAuth} t={t} />
  return <Dashboard user={auth} allUsers={users} onSwitch={handleSwitch} dark={dark} setDark={setDark} t={t} />
}
