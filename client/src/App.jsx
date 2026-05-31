import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'

// ─── Themes ───────────────────────────────────────────────────────────────────

const DARK = {
  bg: '#0a0a0a', bgSub: '#0d0d0d', surface: '#111111', surfaceHover: '#161616',
  card: '#111111', cardSolid: '#111111', border: '#222222', borderHover: '#333333',
  text: '#e8e8e8', textSec: '#888888', muted: '#555555',
  green: '#00c896', greenDim: 'rgba(0,200,150,0.08)', greenBorder: 'rgba(0,200,150,0.2)',
  red: '#e03535', redDim: 'rgba(224,53,53,0.08)', redBorder: 'rgba(224,53,53,0.2)',
  blue: '#00d4ff', blueDim: 'rgba(0,212,255,0.08)', accent: '#00d4ff',
  amber: '#ffaa00', amberDim: 'rgba(255,170,0,0.08)',
  inputBg: 'rgba(255,255,255,0.04)', glow: 'none',
  pin: 'rgba(255,255,255,0.04)', pinText: '#e8e8e8',
}
const LIGHT = {
  bg: '#f0ebe0', bgSub: '#e8e2d4', surface: '#f7f2e6', surfaceHover: '#ede8db',
  card: '#f7f2e6', cardSolid: '#f7f2e6', border: 'rgba(50,40,20,0.14)', borderHover: 'rgba(50,40,20,0.28)',
  text: '#1a1510', textSec: '#5a4e3a', muted: '#8a7d65',
  green: '#1a7a55', greenDim: 'rgba(26,122,85,0.08)', greenBorder: 'rgba(26,122,85,0.2)',
  red: '#b03030', redDim: 'rgba(176,48,48,0.08)', redBorder: 'rgba(176,48,48,0.2)',
  blue: '#0077aa', blueDim: 'rgba(0,119,170,0.08)', accent: '#0077aa',
  amber: '#a06010', amberDim: 'rgba(160,96,16,0.08)',
  inputBg: 'rgba(50,40,20,0.05)', glow: 'none',
  pin: 'rgba(50,40,20,0.05)', pinText: '#1a1510',
}

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const TARGET = 3000
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', 'Consolas', monospace"
const fmt = v => (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })
const LBL = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: MONO }

function ChartTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value ?? 0
  return (
    <div style={{ background: t.cardSolid, border: `1px solid ${t.borderHover}`, padding: '8px 12px' }}>
      <div style={{ ...LBL, color: t.muted, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: v >= 0 ? t.green : t.red, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
        {v >= 0 ? '+' : ''}{fmt(v)}
      </div>
    </div>
  )
}

// ─── Contract Size Calculator ─────────────────────────────────────────────────

const INSTRUMENTS = [
  { id: 'ES',  label: 'ES',  name: 'S&P 500',      mini: 50,   micro: 5,    miniLabel: 'ES',  microLabel: 'MES' },
  { id: 'NQ',  label: 'NQ',  name: 'Nasdaq',        mini: 20,   micro: 2,    miniLabel: 'NQ',  microLabel: 'MNQ' },
  { id: 'YM',  label: 'YM',  name: 'Dow Jones',     mini: 5,    micro: 0.5,  miniLabel: 'YM',  microLabel: 'MYM' },
  { id: 'RTY', label: 'RTY', name: 'Russell 2000',  mini: 50,   micro: 5,    miniLabel: 'RTY', microLabel: 'M2K' },
  { id: 'CL',  label: 'CL',  name: 'Crude Oil',     mini: 1000, micro: 100,  miniLabel: 'CL',  microLabel: 'MCL' },
  { id: 'GC',  label: 'GC',  name: 'Gold',          mini: 100,  micro: 10,   miniLabel: 'GC',  microLabel: 'MGC' },
  { id: '6E',  label: '6E',  name: 'Euro FX',       mini: 12.5, micro: 1.25, miniLabel: '6E',  microLabel: 'M6E' },
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ ...LBL, color: t.muted }}>SIZE CALCULATOR</span>
        <span style={{ fontSize: 10, color: t.muted, fontFamily: MONO }}>{inst.miniLabel} · ${inst.mini.toLocaleString()}/pt</span>
      </div>

      <div style={{ display: 'flex', gap: 3, marginBottom: 12, flexWrap: 'wrap' }}>
        {INSTRUMENTS.map(i => (
          <button key={i.id} onClick={() => setInstrument(i.id)} style={{
            padding: '4px 8px', border: `1px solid ${instrument === i.id ? t.accent : t.border}`,
            background: instrument === i.id ? t.blueDim : 'transparent',
            color: instrument === i.id ? t.accent : t.muted,
            fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.05em',
          }}>{i.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        <input style={{ ...inp, fontFamily: MONO }} type="number" placeholder="SL pts" value={sl} onChange={e => setSl(e.target.value)} />
        <input style={{ ...inp, fontFamily: MONO }} type="number" placeholder="Risk $" value={risk} onChange={e => setRisk(e.target.value)} />
      </div>

      {valid ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: t.border }}>
          <div style={{ background: t.bg, padding: '12px 14px' }}>
            <div style={{ ...LBL, color: t.muted, marginBottom: 6 }}>MINI · {inst.miniLabel}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: t.accent, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{miniContracts}</span>
              <span style={{ fontSize: 10, color: t.muted, fontFamily: MONO }}>${miniActualRisk.toFixed(0)} risk</span>
            </div>
          </div>
          <div style={{ background: t.bg, padding: '12px 14px' }}>
            <div style={{ ...LBL, color: t.muted, marginBottom: 6 }}>MICRO · {inst.microLabel}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: t.green, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{microContracts}</span>
              <span style={{ fontSize: 10, color: t.muted, fontFamily: MONO }}>${microActualRisk.toFixed(0)} risk</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px 0', fontSize: 11, color: t.muted, textAlign: 'center', fontFamily: MONO, letterSpacing: '0.06em' }}>ENTER SL AND RISK TO CALCULATE</div>
      )}
    </div>
  )
}

// ─── Passcode Screen ──────────────────────────────────────────────────────────

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

  const Page = ({ children }) => (
    <div style={{
      background: t.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
      <style>{`
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:0.2}50%{opacity:1}}
      `}</style>
    </div>
  )

  if (!selected) return (
    <Page>
      <div style={{ marginBottom: 36, textAlign: 'center' }}>
        <div style={{ ...LBL, color: t.accent, fontSize: 13, letterSpacing: '0.2em', marginBottom: 10 }}>LUCIDFLEX</div>
        <div style={{ fontSize: 11, color: t.muted, letterSpacing: '0.08em', fontFamily: MONO }}>SELECT ACCOUNT TO CONTINUE</div>
      </div>

      <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'center' }}>
        {users.map((u, idx) => (
          <button key={u.id} onClick={() => setSelected(u)} style={{
            flex: '0 1 160px', padding: '24px 16px',
            border: `1px solid ${t.border}`, background: t.surface,
            cursor: 'pointer', textAlign: 'center',
            transition: 'border-color 0.15s',
            animation: `fadeUp 0.3s ease ${idx * 0.06}s both`,
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = t.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
          >
            <div style={{
              width: 36, height: 36, border: `1px solid ${t.borderHover}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px', fontSize: 14, fontWeight: 700,
              color: t.accent, fontFamily: MONO,
            }}>{u.name[0].toUpperCase()}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, letterSpacing: '0.02em' }}>{u.name}</div>
            <div style={{ ...LBL, color: t.muted, fontSize: 9, marginTop: 5 }}>$50K EVALUATION</div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 44, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 5, height: 5, background: t.green }} />
        <span style={{ ...LBL, color: t.muted, fontSize: 9 }}>EVALUATION TRACKER · ACTIVE</span>
      </div>
    </Page>
  )

  return (
    <Page>
      <button onClick={back} style={{
        alignSelf: 'flex-start', background: 'none', border: 'none',
        color: t.muted, fontSize: 10, cursor: 'pointer', fontFamily: MONO,
        marginBottom: 32, padding: '4px 0', letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>← BACK</button>

      <div style={{ animation: 'fadeUp 0.25s ease both', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, letterSpacing: '0.02em', marginBottom: 6 }}>{selected.name}</div>
          <div style={{ ...LBL, color: t.muted, fontSize: 9 }}>ENTER 4-DIGIT PASSCODE</div>
        </div>

        <input ref={inputRef} type="tel" inputMode="numeric" pattern="[0-9]*"
          autoComplete="one-time-code" value={pin} onChange={e => handleInput(e.target.value)}
          maxLength={4} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} autoFocus />

        <div onClick={() => inputRef.current?.focus()} style={{
          display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20,
          animation: shake ? 'shake 0.4s ease' : 'none', cursor: 'text',
        }}>
          {[0,1,2,3].map(i => {
            const filled = i < pin.length
            const active = i === pin.length && !error
            return (
              <div key={i} style={{
                width: 52, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: t.inputBg,
                border: `1px solid ${error && filled ? t.red : active ? t.accent : filled ? t.borderHover : t.border}`,
                transition: 'border-color 0.1s',
              }}>
                {filled ? <div style={{ width: 8, height: 8, background: error ? t.red : t.accent }} />
                  : active ? <div style={{ width: 1, height: 20, background: t.accent, animation: 'blink 1s ease infinite' }} />
                  : null}
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', height: 18, marginBottom: 18 }}>
          {error && <span style={{ ...LBL, color: t.red, fontSize: 9 }}>WRONG PASSCODE — TRY AGAIN</span>}
          {verifying && !error && <span style={{ ...LBL, color: t.muted, fontSize: 9 }}>VERIFYING…</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, maxWidth: 228, width: '100%' }}>
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
                  height: 46, border: `1px solid ${t.border}`, background: t.inputBg,
                  color: isDel ? t.textSec : t.text,
                  fontSize: isDel ? 12 : 18, fontWeight: 400,
                  cursor: 'pointer', fontFamily: isDel ? FONT : MONO,
                  userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseDown={e => e.currentTarget.style.background = t.surfaceHover}
                onMouseUp={e => e.currentTarget.style.background = t.inputBg}
                onMouseLeave={e => e.currentTarget.style.background = t.inputBg}
              >{isDel ? '⌫' : d}</button>
            )
          })}
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

  const conPct = totalPnl > 0 && bestDayTotal > 0 ? (bestDayTotal / totalPnl) * 100 : 0
  const passing = conPct <= 50 && totalPnl > 0
  const failing = totalPnl > 0 && conPct > 50
  const neededMore = failing ? Math.ceil(bestDayTotal * 2 - totalPnl) : 0
  const maxBestDay = totalPnl > 0 ? Math.floor(totalPnl * 0.5) : 0
  const toTarget = Math.max(0, TARGET - totalPnl)
  const progressPct = Math.min(100, Math.max(0, (totalPnl / TARGET) * 100))
  const computedBalance = 50000 + totalPnl

  const START_BAL = 50000
  const MLL_AMOUNT = 2000
  const ITB = START_BAL + TARGET

  const { highWaterMark, mllFloor, mllBuffer, mllLocked } = useMemo(() => {
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
  const statusColor = accountStatus === 'READY TO PASS' ? t.green : accountStatus === 'FIX CONSISTENCY' || accountStatus === 'AT RISK' ? t.red : t.accent

  const chartColor = totalPnl >= TARGET ? t.green : totalPnl < 0 ? t.red : t.accent
  const chartColorFrom = totalPnl >= TARGET ? '#009970' : totalPnl < 0 ? '#aa1515' : '#0099bb'
  const conColor = failing ? t.red : passing ? t.green : t.accent
  const mllColor = mllPct < 25 ? t.red : mllPct < 50 ? t.amber : t.green

  const displayBalance = overrideActive ? (parseFloat(balance) || computedBalance) : computedBalance

  const inp = {
    padding: '7px 10px', border: `1px solid ${t.border}`, fontSize: 12,
    color: t.text, background: t.inputBg, outline: 'none', fontFamily: MONO,
    boxSizing: 'border-box', transition: 'border-color 0.15s', borderRadius: 0,
  }

  if (!loaded) return (
    <div style={{ background: t.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO }}>
      <div style={{ ...LBL, color: t.muted }}>LOADING…</div>
    </div>
  )

  return (
    <div style={{ background: t.bg, minHeight: '100vh', fontFamily: FONT, color: t.text }}>

      {/* ── Nav Bar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20, height: 44,
        background: t.bg, borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        {/* Left: brand + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ ...LBL, color: t.accent, fontSize: 12, letterSpacing: '0.18em' }}>LF</span>
          <span style={{ width: 1, height: 16, background: t.border }} />
          <span style={{ ...LBL, color: t.textSec, fontSize: 10 }}>
            LUCIDFLEX <span style={{ color: t.muted }}>· $50K EVALUATION</span>
          </span>
          <span style={{ width: 1, height: 16, background: t.border }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, background: statusColor }} />
            <span style={{ ...LBL, color: statusColor, fontSize: 9 }}>{accountStatus}</span>
          </span>
        </div>

        {/* Right: override + users + controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...LBL, color: t.muted, fontSize: 9 }}>BAL OVERRIDE:</span>
          <input
            style={{ ...inp, width: 90, padding: '3px 8px', height: 26, fontSize: 11 }}
            type="number" placeholder="auto"
            value={overrideActive ? balance : ''}
            onChange={e => setBalanceSave(e.target.value)}
          />
          {overrideActive && (
            <button onClick={() => { setOverrideActive(false); setBalance('50000'); save(days, '50000') }}
              style={{ background: 'none', border: 'none', color: t.muted, fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
          )}
          <span style={{ width: 1, height: 16, background: t.border, margin: '0 2px' }} />
          {allUsers.map(u => (
            <button key={u.id} onClick={() => onSwitch(u)} style={{
              padding: '3px 9px', border: `1px solid ${u.id === user.id ? t.borderHover : 'transparent'}`,
              background: 'none', color: u.id === user.id ? t.text : t.muted,
              fontWeight: 600, fontSize: 10, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.06em',
            }}>{u.name.toUpperCase()}</button>
          ))}
          <span style={{ width: 1, height: 16, background: t.border, margin: '0 2px' }} />
          <button onClick={() => setDark(d => !d)} style={{
            width: 28, height: 28, border: `1px solid ${t.border}`, background: 'none',
            color: t.muted, fontSize: 12, cursor: 'pointer',
          }}>{dark ? '☀' : '☾'}</button>
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} style={{
              padding: '3px 9px', border: `1px solid ${t.border}`, background: 'none',
              color: t.muted, fontSize: 10, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.08em',
            }}>RESET</button>
          ) : (
            <>
              <button onClick={resetData} style={{ padding: '3px 9px', border: `1px solid ${t.red}`, background: t.redDim, color: t.red, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.06em' }}>CONFIRM</button>
              <button onClick={() => setConfirmReset(false)} style={{ padding: '3px 9px', border: `1px solid ${t.border}`, background: 'none', color: t.muted, fontSize: 10, cursor: 'pointer', fontFamily: MONO }}>CANCEL</button>
            </>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>

        {/* ── BAND 1: Balance · Target · Days ── */}
        <section style={{ padding: '20px 0', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16, alignItems: 'end', marginBottom: 16 }}>
            {/* Balance — 4 cols */}
            <div style={{ gridColumn: 'span 4' }}>
              <div style={{ ...LBL, color: t.muted, marginBottom: 6 }}>ACCOUNT BALANCE</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: t.text, lineHeight: 1 }}>
                  ${displayBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: totalPnl >= 0 ? t.green : t.red }}>
                  {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
                </span>
              </div>
            </div>
            {/* Target — 4 cols */}
            <div style={{ gridColumn: 'span 4' }}>
              <div style={{ ...LBL, color: t.muted, marginBottom: 6 }}>PROFIT TARGET</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 700, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: totalPnl >= TARGET ? t.green : t.text }}>
                  {Math.round(progressPct)}%
                </span>
                <span style={{ fontSize: 11, color: t.muted, fontFamily: MONO }}>
                  {totalPnl >= TARGET ? 'TARGET HIT ✓' : `${fmt(toTarget)} TO $3K`}
                </span>
              </div>
            </div>
            {/* Days / Trades — 4 cols */}
            <div style={{ gridColumn: 'span 4' }}>
              <div style={{ ...LBL, color: t.muted, marginBottom: 6 }}>TRADING DAYS</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 700, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: t.text, lineHeight: 1 }}>{tradingDays}</span>
                <span style={{ fontSize: 11, color: t.muted, fontFamily: MONO }}>{days.length} TRADES</span>
              </div>
            </div>
          </div>
          {/* Progress bar — full 12 cols */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ ...LBL, color: t.muted, fontSize: 9 }}>TARGET PROGRESS</span>
              <span style={{ ...LBL, color: t.muted, fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>{fmt(totalPnl)} / $3,000</span>
            </div>
            <div style={{ height: 2, background: t.border }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: totalPnl >= TARGET ? t.green : t.accent, transition: 'width 0.5s' }} />
            </div>
          </div>
        </section>

        {/* ── BAND 2: Consistency | MLL ── */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', borderBottom: `1px solid ${t.border}` }}>

          {/* Consistency — 6 cols */}
          <div style={{ gridColumn: 'span 6', padding: '20px', borderRight: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ ...LBL, color: t.muted }}>CONSISTENCY</span>
              <span style={{ ...LBL, fontSize: 9, color: failing ? t.red : passing ? t.green : t.muted }}>
                {totalPnl <= 0 ? '—' : failing ? 'FAILING' : 'PASSING'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 30, fontWeight: 700, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, color: conColor }}>
                {totalPnl > 0 ? `${conPct.toFixed(1)}%` : '—'}
              </span>
              <span style={{ fontSize: 11, color: t.muted }}>of 50% cap</span>
            </div>
            <div style={{ position: 'relative', height: 2, background: t.border, marginBottom: 10 }}>
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: t.muted, opacity: 0.35, zIndex: 1 }} />
              <div style={{ width: `${Math.min(100, conPct)}%`, height: '100%', background: conColor, transition: 'width 0.5s' }} />
            </div>
            {failing && <div style={{ fontSize: 11, color: t.textSec }}>Earn <span style={{ color: t.red, fontFamily: MONO, fontWeight: 700 }}>{fmt(neededMore)}</span> more. Cap each day at <span style={{ color: t.text, fontFamily: MONO, fontWeight: 700 }}>{fmt(bestDayTotal)}</span>.</div>}
            {passing && <div style={{ fontSize: 11, color: t.textSec }}>Max single day: <span style={{ color: t.text, fontFamily: MONO, fontWeight: 700 }}>{fmt(maxBestDay)}</span></div>}
            {totalPnl <= 0 && <div style={{ fontSize: 11, color: t.muted }}>Log trades to track</div>}
          </div>

          {/* MLL — 6 cols */}
          <div style={{ gridColumn: 'span 6', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ ...LBL, color: t.muted }}>MAX LOSS LIMIT</span>
              <span style={{ ...LBL, fontSize: 9, color: mllColor }}>
                {mllPct < 25 ? 'DANGER' : mllPct < 50 ? 'CAUTION' : 'SAFE'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 30, fontWeight: 700, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, color: mllColor }}>
                {fmt(mllBuffer)}
              </span>
              <span style={{ fontSize: 11, color: t.muted }}>buffer</span>
            </div>
            <div style={{ height: 2, background: t.border, marginBottom: 10 }}>
              <div style={{ width: `${mllPct}%`, height: '100%', background: mllColor, transition: 'width 0.5s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.textSec }}>
              <span>FLOOR <span style={{ color: t.text, fontFamily: MONO, fontWeight: 700 }}>${mllFloor.toLocaleString()}</span></span>
              <span>PEAK <span style={{ color: t.text, fontFamily: MONO, fontWeight: 700 }}>${highWaterMark.toLocaleString()}</span></span>
            </div>
          </div>

        </section>

        {/* ── BAND 3: Equity Curve | Stats ── */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', borderBottom: `1px solid ${t.border}` }}>

          {/* Chart — 7 cols */}
          <div style={{ gridColumn: 'span 7', padding: '20px', borderRight: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ ...LBL, color: t.muted, marginBottom: 4 }}>EQUITY CURVE</div>
                <div style={{ fontSize: 10, color: t.textSec, fontFamily: MONO }}>
                  LAST: <span style={{ color: totalPnl >= 0 ? t.green : t.red, fontWeight: 700 }}>{totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}</span>
                  <span style={{ margin: '0 8px', color: t.border }}>·</span>
                  PEAK: <span style={{ color: t.text, fontWeight: 700 }}>{fmt(Math.max(0, ...chartData.map(d => d.cumulative)))}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: t.muted, fontFamily: MONO, letterSpacing: '0.06em' }}>
                  <span style={{ width: 12, height: 1.5, background: t.accent, display: 'inline-block' }} />EQUITY
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: t.muted, fontFamily: MONO, letterSpacing: '0.06em' }}>
                  <span style={{ width: 12, borderTop: `1.5px dashed ${t.green}`, display: 'inline-block' }} />TARGET
                </span>
              </div>
            </div>

            {chartData.length < 2 ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ ...LBL, color: t.muted, fontSize: 9 }}>ADD 2+ TRADES TO SEE CURVE</span>
              </div>
            ) : (
              <div style={{ height: 240, marginLeft: -8, marginRight: -8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 12, right: 32, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="cgPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartColor} stopOpacity={0.35} />
                        <stop offset="50%" stopColor={chartColor} stopOpacity={0.08} />
                        <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="cgStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={chartColorFrom} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={chartColor} />
                      </linearGradient>
                      <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur stdDeviation="3" result="blur"/>
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="1 8" stroke={t.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: t.muted, fontFamily: MONO }} axisLine={false} tickLine={false} dy={6} />
                    <YAxis
                      tick={{ fontSize: 9, fill: t.muted, fontFamily: MONO }} axisLine={false} tickLine={false}
                      tickFormatter={v => { const a = Math.abs(v), s = v < 0 ? '-' : ''; return a >= 1000 ? `${s}$${(a/1000).toFixed(1)}k` : `${s}$${a}` }}
                      domain={[dataMin => Math.min(0, Math.floor(dataMin * 1.15)), dataMax => Math.ceil(Math.max(dataMax, TARGET) * 1.1)]}
                      width={46} dx={-4}
                    />
                    <Tooltip content={<ChartTooltip t={t} />} cursor={{ stroke: t.muted, strokeWidth: 1, strokeDasharray: '3 3', strokeOpacity: 0.4 }} />
                    {/* Glow halo layer */}
                    <Area type="monotone" dataKey="cumulative" stroke={chartColor} strokeWidth={6} fill="none" dot={false} activeDot={false} strokeOpacity={0.15} />
                    {/* Main line */}
                    <Area
                      type="monotone" dataKey="cumulative"
                      stroke="url(#cgStroke)" strokeWidth={2}
                      fill="url(#cgPos)" dot={false}
                      activeDot={{ r: 5, fill: chartColor, stroke: t.bg, strokeWidth: 2, filter: 'url(#dotGlow)' }}
                    />
                    {/* Reference lines on top of area */}
                    <ReferenceLine y={TARGET} stroke={t.green} strokeDasharray="6 4" strokeWidth={1.5} strokeOpacity={0.85} label={{ value: '$3k', position: 'right', fill: t.green, fontSize: 9, fontWeight: 700, fontFamily: MONO, offset: 6 }} />
                    <ReferenceLine y={0} stroke={t.border} strokeWidth={1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Stats — 5 cols */}
          <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}` }}>
              <span style={{ ...LBL, color: t.muted }}>PERFORMANCE STATS</span>
            </div>
            {!metrics ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <span style={{ ...LBL, color: t.muted, fontSize: 9 }}>LOG TRADES TO SEE STATS</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {[
                  { l: 'WIN RATE',      v: `${metrics.winRate.toFixed(0)}%`,                              sub: `${metrics.wins}W · ${metrics.losses}L`,  c: metrics.winRate >= 50 ? t.green : t.red },
                  { l: 'PROFIT FACTOR', v: metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2), sub: 'GROSS WIN ÷ LOSS', c: metrics.profitFactor >= 1.5 ? t.green : metrics.profitFactor >= 1 ? t.amber : t.red },
                  { l: 'AVG R:R',       v: metrics.avgRR > 0 ? metrics.avgRR.toFixed(2) : '—',            sub: 'WIN ÷ LOSS',        c: metrics.avgRR >= 1.5 ? t.green : metrics.avgRR >= 1 ? t.text : t.red },
                  { l: 'EXPECTANCY',    v: (metrics.expectancy >= 0 ? '+' : '') + fmt(metrics.expectancy), sub: 'PER TRADE',          c: metrics.expectancy >= 0 ? t.green : t.red },
                  { l: 'MAX DRAWDOWN',  v: fmt(metrics.maxDD),                                             sub: 'PEAK TO TROUGH',    c: metrics.maxDD > 1000 ? t.red : metrics.maxDD > 500 ? t.amber : t.text },
                  { l: 'BEST / WORST',  v: `+${fmt(bestTrade)} / ${fmt(metrics.worstTrade)}`,              sub: 'SINGLE TRADE',      c: t.text, small: true },
                  { l: 'STREAK',        v: `${metrics.streak}${metrics.streakType ? 'W' : 'L'}`,           sub: 'CURRENT RUN',       c: metrics.streakType ? t.green : t.red },
                ].map((s, i) => (
                  <div key={i} style={{
                    padding: '10px 16px', borderBottom: i < 6 ? `1px solid ${t.border}` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...LBL, color: t.muted, fontSize: 9 }}>{s.l}</div>
                      <div style={{ ...LBL, color: t.muted, fontSize: 8, marginTop: 2, fontWeight: 400, letterSpacing: '0.04em' }}>{s.sub}</div>
                    </div>
                    <span style={{
                      fontSize: s.small ? 11 : 14, fontWeight: 700, color: s.c,
                      fontFamily: MONO, fontVariantNumeric: 'tabular-nums',
                      letterSpacing: s.small ? 0 : -0.3, whiteSpace: 'nowrap', textAlign: 'right',
                    }}>{s.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </section>

        {/* ── BAND 4: Trade Log | Calculator ── */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}>

          {/* Trade Log — 7 cols */}
          <div style={{ gridColumn: 'span 7', padding: '20px', borderRight: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ ...LBL, color: t.muted }}>TRADE LOG</span>
              <span style={{ ...LBL, color: t.muted, fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>{days.length} TRADES · {tradingDays} DAYS</span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
              <input style={{ ...inp, flex: '1 1 120px', fontFamily: FONT, fontSize: 12, minWidth: 0 }} placeholder="Label" value={labelInput} onChange={e => setLabelInput(e.target.value)} />
              <input style={{ ...inp, width: 80 }} placeholder="$" type="number" value={pnlInput} onChange={e => setPnlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTrade()} />
              <input style={{ ...inp, width: 122, fontFamily: FONT, fontSize: 11 }} type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} />
              <button onClick={addTrade} style={{
                padding: '7px 14px', border: `1px solid ${t.accent}`, background: t.blueDim,
                color: t.accent, fontWeight: 700, fontSize: 10, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.08em',
              }}>ADD</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 300, overflowY: 'auto' }}>
              {days.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <span style={{ ...LBL, color: t.muted, fontSize: 9 }}>NO TRADES YET</span>
                </div>
              ) : (
                [...dailyGroups].reverse().map(group => {
                  const isBestDay = group.date === bestDayDate && bestDayTotal > 0
                  const d = group.date !== 'undated' ? new Date(group.date + 'T12:00:00') : null
                  const dayLabel = d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Undated'
                  return (
                    <div key={group.date} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${t.border}`, marginBottom: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isBestDay && <span style={{ ...LBL, color: t.amber, fontSize: 8 }}>★ BEST</span>}
                          <span style={{ ...LBL, color: t.text, fontSize: 10 }}>{dayLabel.toUpperCase()}</span>
                          <span style={{ ...LBL, color: t.muted, fontSize: 8 }}>{group.trades.length}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: group.total >= 0 ? t.green : t.red }}>
                          {group.total >= 0 ? '+' : ''}{fmt(group.total)}
                        </span>
                      </div>
                      {group.trades.map(td => (
                        <div key={td._idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px' }}>
                          <span style={{ fontSize: 11, color: t.textSec }}>{td.label || 'Trade'}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: td.pnl >= 0 ? t.green : t.red }}>{td.pnl >= 0 ? '+' : ''}{fmt(td.pnl)}</span>
                            <button onClick={() => setDaysSave(p => p.filter((_,j) => j !== td._idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 12, padding: 0, lineHeight: 1, opacity: 0.4 }}
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

          {/* Calculator — 5 cols */}
          <div style={{ gridColumn: 'span 5', padding: '20px' }}>
            <ContractCalc t={t} inp={inp} />
          </div>

        </section>

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

  if (users.length === 0) return <div style={{ background: dark ? '#0a0a0a' : '#f0ebe0', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO }}><div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em' }}>LOADING…</div></div>
  if (!auth) return <PasscodeScreen users={switchTarget ? [switchTarget] : users} onAuth={handleAuth} t={t} />
  return <Dashboard user={auth} allUsers={users} onSwitch={handleSwitch} dark={dark} setDark={setDark} t={t} />
}
