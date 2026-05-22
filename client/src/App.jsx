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
  bg: '#f4f5f7', bgSub: '#eef0f3', surface: '#ffffff', surfaceHover: '#f8f9fb',
  card: 'rgba(255,255,255,0.85)', cardSolid: '#ffffff', border: 'rgba(0,0,0,0.07)',
  borderHover: 'rgba(0,0,0,0.12)', text: '#111318', textSec: '#5f6270', muted: '#9a9caa',
  green: '#00b377', greenDim: 'rgba(0,179,119,0.1)', greenBorder: 'rgba(0,179,119,0.25)',
  red: '#e53e5c', redDim: 'rgba(229,62,92,0.1)', redBorder: 'rgba(229,62,92,0.25)',
  blue: '#4f56e8', blueDim: 'rgba(79,86,232,0.08)', accent: 'linear-gradient(135deg, #4f56e8, #8f56e8)',
  amber: '#e5960f', amberDim: 'rgba(229,150,15,0.1)',
  inputBg: 'rgba(0,0,0,0.03)', glow: '0 0 40px rgba(79,86,232,0.06)',
  pin: 'rgba(0,0,0,0.05)', pinText: '#111318',
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
  const miniExact = valid ? riskNum / (slNum * inst.mini) : 0
  const microExact = valid ? riskNum / (slNum * inst.micro) : 0
  const miniActualRisk = valid ? miniContracts * slNum * inst.mini : 0
  const microActualRisk = valid ? microContracts * slNum * inst.micro : 0

  return (
    <GlassCard t={t} style={{ padding: '24px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Size Calculator</div>
      <div style={{ fontSize: 12, color: t.muted, marginBottom: 18 }}>Points-based position sizing</div>

      {/* Instrument picker */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {INSTRUMENTS.map(i => (
          <button key={i.id} onClick={() => setInstrument(i.id)} style={{
            padding: '6px 14px', borderRadius: 8,
            border: `1px solid ${instrument === i.id ? '#636bff44' : t.border}`,
            background: instrument === i.id ? t.blueDim : 'transparent',
            color: instrument === i.id ? '#636bff' : t.textSec,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
            transition: 'all 0.15s',
          }}>{i.label}</button>
        ))}
      </div>

      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: t.muted, marginBottom: 6, fontWeight: 500 }}>Stop loss (points)</div>
          <input
            style={{ ...inp, width: '100%', fontSize: 14 }}
            type="number" placeholder="e.g. 10"
            value={sl} onChange={e => setSl(e.target.value)}
            onFocus={e => e.target.style.borderColor = '#636bff66'}
            onBlur={e => e.target.style.borderColor = t.border}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: t.muted, marginBottom: 6, fontWeight: 500 }}>Risk amount ($)</div>
          <input
            style={{ ...inp, width: '100%', fontSize: 14 }}
            type="number" placeholder="e.g. 200"
            value={risk} onChange={e => setRisk(e.target.value)}
            onFocus={e => e.target.style.borderColor = '#636bff66'}
            onBlur={e => e.target.style.borderColor = t.border}
          />
        </div>
      </div>

      {/* Results */}
      {valid ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{
            background: t.blueDim, border: `1px solid rgba(99,107,255,0.15)`,
            borderRadius: 14, padding: '18px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: t.muted, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
              Mini ({inst.miniLabel})
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#636bff', letterSpacing: -1, lineHeight: 1, marginBottom: 4 }}>
              {miniContracts}
            </div>
            <div style={{ fontSize: 11, color: t.muted }}>
              contract{miniContracts !== 1 ? 's' : ''} · ${inst.mini.toLocaleString()}/pt
            </div>
            <div style={{ fontSize: 11, color: miniActualRisk > riskNum ? t.amber : t.textSec, marginTop: 6 }}>
              Actual risk: ${miniActualRisk.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
          </div>
          <div style={{
            background: t.greenDim, border: `1px solid ${t.greenBorder}`,
            borderRadius: 14, padding: '18px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: t.muted, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
              Micro ({inst.microLabel})
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: t.green, letterSpacing: -1, lineHeight: 1, marginBottom: 4 }}>
              {microContracts}
            </div>
            <div style={{ fontSize: 11, color: t.muted }}>
              contract{microContracts !== 1 ? 's' : ''} · ${inst.micro.toLocaleString()}/pt
            </div>
            <div style={{ fontSize: 11, color: microActualRisk > riskNum ? t.amber : t.textSec, marginTop: 6 }}>
              Actual risk: ${microActualRisk.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: t.inputBg, borderRadius: 14, padding: '28px 16px',
          textAlign: 'center', border: `1px dashed ${t.border}`,
        }}>
          <div style={{ fontSize: 13, color: t.muted }}>Enter SL points and risk $ to calculate</div>
        </div>
      )}

      {/* Quick math breakdown */}
      {valid && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: t.inputBg, borderRadius: 10, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, color: t.muted, lineHeight: 1.6 }}>
            {slNum} pt × ${inst.micro.toLocaleString()}/pt = ${(slNum * inst.micro).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} per micro · ${riskNum} ÷ ${(slNum * inst.micro).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} = {microExact.toFixed(2)} → <span style={{ color: t.text, fontWeight: 600 }}>{microContracts} micro{microContracts !== 1 ? 's' : ''}</span>
            {microActualRisk > riskNum && <span style={{ color: t.amber }}> (${(microActualRisk - riskNum).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} over target)</span>}
          </div>
        </div>
      )}
    </GlassCard>
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
    <div style={{
      background: t.bg, minHeight: '100vh', fontFamily: FONT,
      padding: '0 0 60px', boxSizing: 'border-box',
      backgroundImage: `radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,107,255,0.06), transparent)`,
    }}>

      {/* ── Top Bar ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px', borderBottom: `1px solid ${t.border}`,
        background: t.card, backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>LF</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>LucidFlex $50K</span>
          <StatusBadge text={accountStatus} color={statusColor} bg={statusBg} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {allUsers.map(u => (
            <button key={u.id} onClick={() => onSwitch(u)} style={{
              padding: '5px 12px', borderRadius: 8, border: `1px solid ${u.id === user.id ? t.blue + '44' : t.border}`,
              background: u.id === user.id ? t.blueDim : 'transparent',
              color: u.id === user.id ? t.blue : t.textSec, fontWeight: 600, fontSize: 12,
              cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
            }}>{u.name}</button>
          ))}
          <div style={{ width: 1, height: 20, background: t.border, margin: '0 4px' }} />
          <button onClick={() => setDark(d => !d)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSec, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {dark ? '☀' : '☾'}
          </button>
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} style={{ height: 32, padding: '0 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.muted, fontSize: 11, cursor: 'pointer', fontFamily: FONT, fontWeight: 500 }}>Reset</button>
          ) : (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={resetData} style={{ height: 32, padding: '0 10px', borderRadius: 8, border: `1px solid ${t.redBorder}`, background: t.redDim, color: t.red, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Confirm</button>
              <button onClick={() => setConfirmReset(false)} style={{ height: 32, padding: '0 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.muted, fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 20px 0' }}>

        {/* ── Hero Section ── */}
        <GlassCard t={t} glow style={{ marginBottom: 16, padding: '28px 28px 24px', position: 'relative', overflow: 'hidden' }}>
          {/* Subtle gradient orb */}
          <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,107,255,0.08), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Account Balance</div>
              <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -2, lineHeight: 1, color: t.text, marginBottom: 8 }}>
                ${(overrideActive ? (parseFloat(balance) || computedBalance) : computedBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 14, fontWeight: 700,
                  color: totalPnl >= 0 ? t.green : t.red,
                  background: totalPnl >= 0 ? t.greenDim : t.redDim,
                  padding: '4px 10px', borderRadius: 8,
                }}>
                  {totalPnl >= 0 ? '▲' : '▼'} {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
                </span>
                <span style={{ fontSize: 12, color: t.muted }}>from $50,000</span>
                <div style={{ width: 1, height: 14, background: t.border }} />
                <span style={{ fontSize: 12, color: t.textSec }}>{days.length} trade{days.length !== 1 ? 's' : ''} · {tradingDays} day{tradingDays !== 1 ? 's' : ''}</span>
              </div>
              {/* Override */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                <span style={{ fontSize: 11, color: t.muted }}>Broker override:</span>
                <input style={{ ...inp, width: 110, fontSize: 12, padding: '6px 10px', borderRadius: 8 }} type="number" placeholder="auto" value={overrideActive ? balance : ''} onChange={e => setBalanceSave(e.target.value)} />
                {overrideActive && (
                  <button onClick={() => { setOverrideActive(false); setBalance('50000'); save(days, '50000') }} style={{ background: 'none', border: 'none', color: t.muted, fontSize: 11, cursor: 'pointer', fontFamily: FONT, textDecoration: 'underline' }}>clear</button>
                )}
              </div>
            </div>

            {/* Right side — target ring */}
            <div style={{ textAlign: 'center', minWidth: 140 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke={t.inputBg} strokeWidth="7" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="url(#targetGrad)" strokeWidth="7"
                    strokeLinecap="round" strokeDasharray={Math.PI * 100}
                    strokeDashoffset={Math.PI * 100 - (progressPct / 100) * Math.PI * 100}
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                  <defs>
                    <linearGradient id="targetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#636bff" />
                      <stop offset="100%" stopColor={totalPnl >= TARGET ? '#00d68f' : '#9f6bff'} />
                    </linearGradient>
                  </defs>
                  <text x="60" y="56" textAnchor="middle" fill={t.text} fontSize="22" fontWeight="800" fontFamily={FONT}>
                    {Math.round(progressPct)}%
                  </text>
                  <text x="60" y="72" textAnchor="middle" fill={t.muted} fontSize="10" fontWeight="500" fontFamily={FONT}>
                    of $3,000
                  </text>
                </svg>
              </div>
              <div style={{ fontSize: 11, color: t.textSec, marginTop: 4 }}>{totalPnl >= TARGET ? 'Target reached' : `${fmt(toTarget)} to target`}</div>
            </div>
          </div>
        </GlassCard>

        {/* ── Quick Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total P&L', value: days.length === 0 ? '—' : fmt(totalPnl), color: days.length === 0 ? t.muted : totalPnl >= 0 ? t.green : t.red },
            { label: 'Best day', value: bestDayTotal > 0 ? '+' + fmt(bestDayTotal) : '—', color: t.blue },
            { label: 'MLL buffer', value: fmt(Math.max(0, mllBuffer)), color: mllPct < 25 ? t.red : mllPct < 50 ? t.amber : t.green },
            { label: 'Consistency', value: totalPnl > 0 ? `${conPct.toFixed(0)}%` : '—', color: conColor },
          ].map((s, i) => (
            <GlassCard key={i} t={t} style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 11, color: t.muted, fontWeight: 500, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: -0.8, lineHeight: 1 }}>{s.value}</div>
            </GlassCard>
          ))}
        </div>

        {/* ── Main Grid: Consistency + MLL ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 16 }}>

          {/* Consistency */}
          <GlassCard t={t} style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 2 }}>Consistency Check</div>
                <div style={{ fontSize: 12, color: t.muted }}>Best day ÷ Total ≤ 50%</div>
              </div>
              <StatusBadge
                text={totalPnl <= 0 ? 'NO DATA' : failing ? 'FAILING' : 'PASSING'}
                color={totalPnl <= 0 ? t.muted : conColor}
                bg={totalPnl <= 0 ? t.inputBg : failing ? t.redDim : t.greenDim}
              />
            </div>

            {/* Arc gauge */}
            <div style={{ textAlign: 'center', margin: '8px 0 16px' }}>
              <ArcGauge pct={totalPnl > 0 ? conPct : 0} color={conColor} size={160} t={t} />
              <div style={{ marginTop: -4, fontSize: 28, fontWeight: 800, color: conColor, letterSpacing: -1 }}>
                {totalPnl > 0 ? `${conPct.toFixed(1)}%` : '—'}
              </div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>of 50% maximum</div>
            </div>

            {failing && (
              <div style={{ background: t.redDim, border: `1px solid ${t.redBorder}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.red, marginBottom: 6 }}>Earn {fmt(neededMore)} more to fix</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { l: 'Best day', v: fmt(bestDayTotal) },
                    { l: 'Total now', v: fmt(totalPnl) },
                    { l: 'Need total', v: fmt(bestDayTotal * 2) },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: t.muted, marginBottom: 2 }}>{s.l}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {passing && (
              <div style={{ background: t.greenDim, border: `1px solid ${t.greenBorder}`, borderRadius: 12, padding: '12px 14px', fontSize: 13, color: t.green }}>
                Max single day allowed: <strong>{fmt(maxBestDay)}</strong>
              </div>
            )}

            {totalPnl <= 0 && (
              <div style={{ textAlign: 'center', fontSize: 13, color: t.muted, padding: '10px 0' }}>
                Log trades to track consistency
              </div>
            )}
          </GlassCard>

          {/* MLL */}
          <GlassCard t={t} style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 2 }}>Max Loss Limit</div>
                <div style={{ fontSize: 12, color: t.muted }}>
                  EOD trailing · {mllLocked ? 'Locked ✓' : 'Active — floor rises with you'}
                </div>
              </div>
              <StatusBadge
                text={mllBuffer <= 0 ? 'BREACHED' : mllPct < 25 ? 'DANGER' : mllPct < 50 ? 'CAUTION' : 'SAFE'}
                color={mllPct < 25 ? t.red : mllPct < 50 ? t.amber : t.green}
                bg={mllPct < 25 ? t.redDim : mllPct < 50 ? t.amberDim : t.greenDim}
              />
            </div>

            {/* Risk visualization */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: t.muted }}>Distance to floor</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{fmt(mllBuffer)}</span>
              </div>
              <div style={{ position: 'relative', height: 10, borderRadius: 99, overflow: 'hidden', background: t.inputBg }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '25%', background: 'rgba(255,77,106,0.08)' }} />
                <div style={{ position: 'absolute', left: '25%', top: 0, bottom: 0, width: '25%', background: 'rgba(255,176,32,0.06)' }} />
                <div style={{
                  width: `${mllPct}%`, height: '100%', borderRadius: 99,
                  background: mllPct < 25 ? `linear-gradient(90deg, ${t.red}, #ff6b84)` : mllPct < 50 ? `linear-gradient(90deg, ${t.amber}, #ffc84d)` : `linear-gradient(90deg, ${t.green}, #33e8aa)`,
                  transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)', boxShadow: `0 0 12px ${mllPct < 25 ? 'rgba(255,77,106,0.3)' : mllPct < 50 ? 'rgba(255,176,32,0.3)' : 'rgba(0,214,143,0.2)'}`,
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 10, color: t.red, fontWeight: 600 }}>${mllFloor.toLocaleString()}</span>
                <span style={{ fontSize: 10, color: t.muted }}>${highWaterMark.toLocaleString()}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={{ background: t.inputBg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 10, color: t.muted, fontWeight: 500, marginBottom: 4, letterSpacing: 0.3, textTransform: 'uppercase' }}>Floor</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: t.red, letterSpacing: -0.5 }}>${mllFloor.toLocaleString()}</div>
              </div>
              <div style={{ background: t.inputBg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 10, color: t.muted, fontWeight: 500, marginBottom: 4, letterSpacing: 0.3, textTransform: 'uppercase' }}>Peak EOD</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: -0.5 }}>${highWaterMark.toLocaleString()}</div>
              </div>
              <div style={{
                background: mllPct < 25 ? t.redDim : mllPct < 50 ? t.amberDim : t.greenDim,
                borderRadius: 12, padding: '12px 14px',
                border: `1px solid ${mllPct < 25 ? t.redBorder : mllPct < 50 ? 'rgba(255,176,32,0.2)' : t.greenBorder}`,
              }}>
                <div style={{ fontSize: 10, color: t.muted, fontWeight: 500, marginBottom: 4, letterSpacing: 0.3, textTransform: 'uppercase' }}>Buffer</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: mllPct < 25 ? t.red : mllPct < 50 ? t.amber : t.green, letterSpacing: -0.5 }}>
                  {fmt(mllBuffer)}
                </div>
              </div>
            </div>

            {!mllLocked && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: t.inputBg, borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 11, color: t.muted, lineHeight: 1.6 }}>
                Locks at <strong style={{ color: t.text }}>${ITB.toLocaleString()}</strong> EOD close — {computedBalance >= ITB ? 'reached ✓' : `${fmt(ITB - computedBalance)} away`}
              </div>
            )}
          </GlassCard>
        </div>

        {/* ── Equity Curve + Metrics ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, marginBottom: 16 }}>

        <GlassCard t={t} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Equity Curve</div>
              <div style={{ fontSize: 12, color: t.muted }}>Trade-by-trade performance</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: t.muted }}>
              <span style={{ width: 16, height: 2, background: t.green, display: 'inline-block', borderRadius: 1 }} />
              $3k target
            </div>
          </div>
          {chartData.length < 2 ? (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.inputBg, borderRadius: 12, border: `1px dashed ${t.border}` }}>
              <span style={{ fontSize: 13, color: t.muted }}>Add 2+ trades to see the equity curve</span>
            </div>
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#636bff" stopOpacity={0.25} />
                      <stop offset="50%" stopColor="#636bff" stopOpacity={0.05} />
                      <stop offset="100%" stopColor="#636bff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" stroke={t.border} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: t.muted, fontFamily: FONT }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: t.muted, fontFamily: FONT }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} width={42} />
                  <Tooltip content={<ChartTooltip t={t} />} />
                  <ReferenceLine y={TARGET} stroke={t.green} strokeDasharray="6 4" strokeWidth={1} strokeOpacity={0.6} />
                  <ReferenceLine y={0} stroke={t.border} />
                  <Area type="monotone" dataKey="cumulative" stroke="#636bff" strokeWidth={2.5}
                    fill="url(#chartGrad)"
                    dot={{ fill: '#636bff', r: 3, stroke: t.cardSolid, strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#636bff', stroke: t.cardSolid, strokeWidth: 2, style: { filter: 'drop-shadow(0 0 6px rgba(99,107,255,0.5))' } }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        {/* ── Performance Metrics ── */}
        <GlassCard t={t} style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>Performance</div>
          <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>{days.length} trade{days.length !== 1 ? 's' : ''} logged</div>

          {!metrics ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, color: t.muted }}>Log trades to see metrics</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>

              {/* Win rate bar */}
              <div style={{ background: t.inputBg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: t.textSec }}>Win rate</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: metrics.winRate >= 50 ? t.green : t.red }}>{metrics.winRate.toFixed(0)}%</span>
                </div>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 8 }}>
                  <div style={{ width: `${metrics.winRate}%`, background: t.green, transition: 'width 0.5s' }} />
                  <div style={{ flex: 1, background: t.red + '44' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: t.green }}>{metrics.wins}W</span>
                  <span style={{ fontSize: 10, color: t.red }}>{metrics.losses}L</span>
                </div>
              </div>

              {/* Metric grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
                {[
                  { l: 'Profit factor', v: metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2), c: metrics.profitFactor >= 1.5 ? t.green : metrics.profitFactor >= 1 ? t.amber : t.red },
                  { l: 'Expectancy', v: (metrics.expectancy >= 0 ? '+' : '') + fmt(metrics.expectancy), c: metrics.expectancy >= 0 ? t.green : t.red },
                  { l: 'Avg win', v: '+' + fmt(metrics.avgWin), c: t.green },
                  { l: 'Avg loss', v: '-' + fmt(metrics.avgLoss), c: t.red },
                  { l: 'Avg R:R', v: metrics.avgRR > 0 ? metrics.avgRR.toFixed(2) : '—', c: metrics.avgRR >= 1.5 ? t.green : metrics.avgRR >= 1 ? t.text : t.red },
                  { l: 'Max drawdown', v: fmt(metrics.maxDD), c: metrics.maxDD > 1000 ? t.red : metrics.maxDD > 500 ? t.amber : t.text },
                  { l: 'Best trade', v: bestTrade > 0 ? '+' + fmt(bestTrade) : '—', c: t.green },
                  { l: 'Worst trade', v: metrics.worstTrade < 0 ? fmt(metrics.worstTrade) : '—', c: t.red },
                ].map((m, i) => (
                  <div key={i} style={{ background: t.inputBg, borderRadius: 10, padding: '10px 12px', border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 10, color: t.muted, fontWeight: 500, marginBottom: 4, letterSpacing: 0.3, textTransform: 'uppercase' }}>{m.l}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: m.c, letterSpacing: -0.5 }}>{m.v}</div>
                  </div>
                ))}
              </div>

              {/* Streak */}
              <div style={{
                background: metrics.streakType ? t.greenDim : t.redDim,
                border: `1px solid ${metrics.streakType ? t.greenBorder : t.redBorder}`,
                borderRadius: 10, padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: t.textSec }}>Current streak</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: metrics.streakType ? t.green : t.red }}>
                  {metrics.streak}{metrics.streakType ? 'W' : 'L'} {metrics.streakType ? '🔥' : ''}
                </span>
              </div>
            </div>
          )}
        </GlassCard>

        </div>

        {/* ── Daily Log + Calculator ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>

        <GlassCard t={t} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Trade Log</div>
              <div style={{ fontSize: 12, color: t.muted }}>{days.length} trade{days.length !== 1 ? 's' : ''} · {tradingDays} day{tradingDays !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <input style={{ ...inp, flex: '1 1 140px', fontSize: 13, minWidth: 0 }} placeholder="e.g. NQ long, ES scalp" value={labelInput} onChange={e => setLabelInput(e.target.value)}
              onFocus={e => e.target.style.borderColor = t.blue + '66'} onBlur={e => e.target.style.borderColor = t.border} />
            <input style={{ ...inp, width: 90, fontSize: 13 }} placeholder="P&L $" type="number" value={pnlInput}
              onChange={e => setPnlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTrade()}
              onFocus={e => e.target.style.borderColor = t.blue + '66'} onBlur={e => e.target.style.borderColor = t.border} />
            <input style={{ ...inp, width: 130, fontSize: 12, color: dateInput ? t.text : t.muted }} type="date" value={dateInput}
              onChange={e => setDateInput(e.target.value)}
              onFocus={e => e.target.style.borderColor = t.blue + '66'} onBlur={e => e.target.style.borderColor = t.border} />
            <button onClick={addTrade} style={{
              padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: t.accent, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: FONT,
              boxShadow: '0 2px 12px rgba(99,107,255,0.25)', transition: 'transform 0.1s',
            }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >Add</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340, overflowY: 'auto' }}>
            {days.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: t.muted }}>No trades logged yet — add your first trade above</div>
            ) : (
              [...dailyGroups].reverse().map(group => {
                const isBestDay = group.date === bestDayDate && bestDayTotal > 0
                const d = group.date !== 'undated' ? new Date(group.date + 'T12:00:00') : null
                const dayLabel = d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Undated'
                return (
                  <div key={group.date}>
                    {/* Day header */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 10,
                      background: isBestDay ? 'rgba(255,176,32,0.06)' : t.inputBg,
                      border: `1px solid ${isBestDay ? 'rgba(255,176,32,0.15)' : t.border}`,
                      marginBottom: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isBestDay && <span style={{ fontSize: 9, fontWeight: 800, color: t.amber, background: t.amberDim, padding: '2px 7px', borderRadius: 4, letterSpacing: 0.5 }}>BEST DAY</span>}
                        <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{dayLabel}</span>
                        <span style={{ fontSize: 11, color: t.muted }}>{group.trades.length} trade{group.trades.length !== 1 ? 's' : ''}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: group.total >= 0 ? t.green : t.red, fontVariantNumeric: 'tabular-nums' }}>
                        {group.total >= 0 ? '+' : ''}{fmt(group.total)}
                      </span>
                    </div>
                    {/* Trades under this day */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 12, marginBottom: 2 }}>
                      {group.trades.map(d => (
                        <div key={d._idx} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 12px', borderRadius: 8,
                          borderLeft: `2px solid ${d.pnl >= 0 ? t.green + '44' : t.red + '44'}`,
                          background: 'transparent',
                        }}>
                          <span style={{ fontSize: 12, color: t.textSec, fontWeight: 500 }}>{d.label || `Trade`}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: d.pnl >= 0 ? t.green : t.red, fontVariantNumeric: 'tabular-nums' }}>
                              {d.pnl >= 0 ? '+' : ''}{fmt(d.pnl)}
                            </span>
                            <button onClick={() => setDaysSave(p => p.filter((_,j) => j !== d._idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 14, padding: 0, lineHeight: 1, transition: 'color 0.15s', opacity: 0.5 }}
                              onMouseEnter={e => { e.currentTarget.style.color = t.red; e.currentTarget.style.opacity = '1' }}
                              onMouseLeave={e => { e.currentTarget.style.color = t.muted; e.currentTarget.style.opacity = '0.5' }}
                            >×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </GlassCard>

        {/* ── Contract Size Calculator ── */}
        <ContractCalc t={t} inp={inp} />

        </div>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(() => { const v = localStorage.getItem('lf-dark'); return v === null ? true : v === '1' })
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
