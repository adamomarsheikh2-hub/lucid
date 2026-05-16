import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'

// ─── Theme ────────────────────────────────────────────────────────────────────

const LIGHT = {
  bg: '#f5f6f8', card: '#ffffff', border: '#e8eaed',
  text: '#1a1f2e', muted: '#7a8394', faint: '#f0f1f4',
  green: '#16a34a', greenBg: '#f0fdf4', greenBorder: '#bbf7d0',
  red: '#dc2626', redBg: '#fef2f2', redBorder: '#fecaca',
  blue: '#2563eb', amber: '#d97706', amberBg: '#fffbeb',
  inputBg: '#f0f1f4', pin: '#e8eaed', pinText: '#1a1f2e',
}
const DARK = {
  bg: '#0f1117', card: '#1c1f27', border: '#2a2e3a',
  text: '#e8eaed', muted: '#6b7280', faint: '#252933',
  green: '#22c55e', greenBg: '#052e16', greenBorder: '#166534',
  red: '#ef4444', redBg: '#1f0a0a', redBorder: '#7f1d1d',
  blue: '#3b82f6', amber: '#f59e0b', amberBg: '#1a1200',
  inputBg: '#252933', pin: '#2a2e3a', pinText: '#e8eaed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TARGET = 3000
const MLL_FLOOR = 48000
const fmt = v => (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })

function Bar({ value, max, color, height = 8 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div style={{ borderRadius: 99, height, overflow: 'hidden', background: 'rgba(128,128,128,0.15)' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: color, transition: 'width 0.4s ease' }} />
    </div>
  )
}

function ChartTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value ?? 0
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '8px 12px' }}>
      <div style={{ fontSize: 11, color: t.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: v >= 0 ? t.green : t.red }}>
        {v >= 0 ? '+' : ''}{fmt(v)}
      </div>
    </div>
  )
}

// ─── Passcode Screen ──────────────────────────────────────────────────────────

function PasscodeScreen({ users, onAuth, dark, t }) {
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const handleDigit = d => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) verify(next)
  }

  const verify = async (code) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.id, passcode: code }),
      })
      if (res.ok) {
        const data = await res.json()
        onAuth(data)
      } else {
        setShake(true)
        setError(true)
        setPin('')
        setTimeout(() => setShake(false), 500)
        setTimeout(() => setError(false), 1500)
      }
    } catch {
      setPin('')
    }
  }

  const cardStyle = {
    background: t.card, border: `1px solid ${t.border}`,
    borderRadius: 16, padding: '16px 18px',
  }

  return (
    <div style={{ background: t.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif", padding: 20 }}>
      <div style={{ marginBottom: 8, fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: -0.4 }}>LucidFlex</div>
      <div style={{ fontSize: 13, color: t.muted, marginBottom: 36 }}>$50K Evaluation Tracker</div>

      {!selected ? (
        <>
          <div style={{ fontSize: 13, color: t.muted, marginBottom: 16 }}>Who are you?</div>
          <div style={{ display: 'flex', gap: 14 }}>
            {users.map(u => (
              <button key={u.id} onClick={() => setSelected(u)} style={{
                width: 130, padding: '22px 16px', borderRadius: 16,
                border: `1.5px solid ${t.border}`, background: t.card,
                cursor: 'pointer', textAlign: 'center',
              }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: t.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                  {u.name[0].toUpperCase()}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{u.name}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ width: '100%', maxWidth: 280 }}>
          <button onClick={() => { setSelected(null); setPin('') }} style={{ background: 'none', border: 'none', color: t.muted, fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>
            ← Back
          </button>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: t.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 22, fontWeight: 700, color: '#fff' }}>
              {selected.name[0].toUpperCase()}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{selected.name}</div>
            <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>Enter your passcode</div>
          </div>

          {/* PIN dots */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 28,
            animation: shake ? 'shake 0.4s ease' : 'none',
          }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: '50%',
                background: i < pin.length ? (error ? t.red : t.blue) : t.faint,
                border: `2px solid ${i < pin.length ? (error ? t.red : t.blue) : t.border}`,
                transition: 'all 0.15s',
              }} />
            ))}
          </div>

          {/* Numpad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((d, i) => (
              <button key={i} onClick={() => {
                if (d === '⌫') setPin(p => p.slice(0, -1))
                else if (d !== '') handleDigit(String(d))
              }} style={{
                height: 58, borderRadius: 14,
                border: `1px solid ${t.border}`,
                background: d === '' ? 'transparent' : t.pin,
                color: t.pinText, fontSize: 20, fontWeight: 500,
                cursor: d === '' ? 'default' : 'pointer',
                pointerEvents: d === '' ? 'none' : 'auto',
              }}>
                {d}
              </button>
            ))}
          </div>
          {error && <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: t.red }}>Wrong passcode</div>}
        </div>
      )}

      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }`}</style>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ user, allUsers, onSwitch, dark, setDark, t }) {
  const [days, setDays] = useState([])
  const [balance, setBalance] = useState('50000')
  const [pnlInput, setPnlInput] = useState('')
  const [labelInput, setLabelInput] = useState('')
  const [loaded, setLoaded] = useState(false)
  const saveTimer = useRef(null)

  // Load data on mount
  useEffect(() => {
    fetch(`/api/data/${user.id}`)
      .then(r => r.json())
      .then(d => {
        setDays(d.days || [])
        setBalance(d.balance || '50000')
        setLoaded(true)
      })
  }, [user.id])

  // Auto-save on change
  const save = useCallback((d, b) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch(`/api/data/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: d, balance: b }),
      })
    }, 600)
  }, [user.id])

  const setDaysSave = fn => setDays(prev => { const next = fn(prev); save(next, balance); return next })
  const setBalanceSave = v => { setBalance(v); save(days, v) }

  // ── Calculations ──
  const totalPnl = useMemo(() => days.reduce((s, d) => s + d.pnl, 0), [days])
  const bestDay = useMemo(() => {
    const pos = days.filter(d => d.pnl > 0)
    return pos.length > 0 ? Math.max(...pos.map(d => d.pnl)) : 0
  }, [days])

  const conPct = totalPnl > 0 && bestDay > 0 ? (bestDay / totalPnl) * 100 : 0
  const passing = conPct <= 50 && totalPnl > 0
  const failing = totalPnl > 0 && conPct > 50
  const neededMore = failing ? Math.ceil(bestDay * 2 - totalPnl) : 0
  const maxBestDay = totalPnl > 0 ? Math.floor(totalPnl * 0.5) : 0
  const toTarget = Math.max(0, TARGET - totalPnl)

  const bal = parseFloat(balance) || 50000
  const computedBalance = 50000 + totalPnl
  const mllBuffer = bal - MLL_FLOOR
  const mllPct = Math.min(100, Math.max(0, (mllBuffer / 2000) * 100))

  const chartData = useMemo(() => {
    let cum = 0
    return days.map((d, i) => {
      cum += d.pnl
      return { name: d.label || `D${i + 1}`, cumulative: parseFloat(cum.toFixed(2)) }
    })
  }, [days])

  const addDay = () => {
    const v = parseFloat(pnlInput)
    if (isNaN(v)) return
    setDaysSave(prev => [...prev, { pnl: v, label: labelInput.trim() }])
    setPnlInput(''); setLabelInput('')
  }

  const card = { background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: '16px 18px' }
  const inp = { padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.border}`, fontSize: 14, color: t.text, background: t.inputBg, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }

  const conColor = failing ? t.red : passing ? t.green : t.blue
  const conBg = failing ? t.redBg : passing ? t.greenBg : t.card
  const conBorder = failing ? t.redBorder : passing ? t.greenBorder : t.border

  if (!loaded) {
    return (
      <div style={{ background: t.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
        <div style={{ color: t.muted, fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ background: t.bg, minHeight: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif", padding: '16px 16px 60px', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, letterSpacing: -0.4 }}>LucidFlex $50K</div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Evaluation tracker</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* User switcher */}
          {allUsers.map(u => (
            <button key={u.id} onClick={() => onSwitch(u)} style={{
              padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${u.id === user.id ? t.blue : t.border}`,
              background: u.id === user.id ? t.blue : 'transparent',
              color: u.id === user.id ? '#fff' : t.muted,
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              {u.name}
            </button>
          ))}
          <button onClick={() => setDark(d => !d)} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.border}`, background: t.faint, color: t.text, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Account balance banner */}
      <div style={{ ...card, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: t.muted, marginBottom: 4 }}>ACCOUNT BALANCE</div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: computedBalance >= 50000 ? t.green : t.red }}>
            ${computedBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 3 }}>
            Started at $50,000 · {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)} P&L
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ fontSize: 11, color: t.muted }}>Override balance</div>
          <input
            style={{ ...inp, width: 130, fontSize: 13 }}
            type="number"
            placeholder="50000"
            value={balance}
            onChange={e => setBalanceSave(e.target.value)}
          />
          <div style={{ fontSize: 11, color: t.muted }}>Use if your broker differs</div>
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        {[
          {
            label: 'Total P&L',
            value: days.length === 0 ? '—' : fmt(totalPnl),
            sub: totalPnl >= TARGET ? 'Target hit ✓' : days.length > 0 ? `${fmt(toTarget)} left` : 'log days below',
            color: days.length === 0 ? t.muted : totalPnl >= 0 ? t.green : t.red,
          },
          {
            label: 'Best day',
            value: bestDay > 0 ? '+' + fmt(bestDay) : '—',
            sub: bestDay > 0 ? `${conPct.toFixed(0)}% of total` : 'none yet',
            color: t.blue,
          },
          {
            label: 'Days',
            value: days.length,
            sub: days.length < 2 ? 'need 2+' : 'min met ✓',
            color: days.length >= 2 ? t.green : t.amber,
          },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '14px' }}>
            <div style={{ fontSize: 11, color: t.muted, marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: -0.4, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: t.muted }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Target progress */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Target progress</span>
          <span style={{ fontSize: 12, color: t.muted }}>{fmt(Math.max(0, totalPnl))} / $3,000</span>
        </div>
        <Bar value={totalPnl} max={TARGET} color={totalPnl >= TARGET ? t.green : t.blue} />
      </div>

      {/* Consistency */}
      <div style={{ ...card, marginBottom: 12, background: conBg, border: `1px solid ${conBorder}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Consistency</div>
            <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Best day ÷ Total profit ≤ 50%</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 11px', borderRadius: 20, background: totalPnl <= 0 ? t.faint : conColor, color: totalPnl <= 0 ? t.muted : '#fff' }}>
            {totalPnl <= 0 ? '—' : failing ? 'FAILING' : 'PASSING'}
          </span>
        </div>

        {totalPnl > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: t.muted }}>Best day share</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: conColor }}>{conPct.toFixed(1)}% / 50% max</span>
            </div>
            <div style={{ position: 'relative', marginBottom: 4 }}>
              <Bar value={conPct} max={100} color={conColor} />
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 2, height: 8, background: t.muted, opacity: 0.5 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: t.muted }}>0%</span>
              <span style={{ fontSize: 10, color: t.muted }}>50% limit</span>
              <span style={{ fontSize: 10, color: t.muted }}>100%</span>
            </div>
          </>
        )}

        {totalPnl <= 0 && <div style={{ fontSize: 13, color: t.muted }}>Log days below to track consistency.</div>}

        {failing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { l: 'Best day', v: fmt(bestDay) },
              { l: 'Total now', v: fmt(totalPnl) },
              { l: `Need ${fmt(neededMore)} more`, v: fmt(bestDay * 2), hi: true },
            ].map((s, i) => (
              <div key={i} style={{ background: dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '9px 10px', border: `1px solid ${s.hi ? t.red : t.redBorder}` }}>
                <div style={{ fontSize: 10, color: t.muted, marginBottom: 3 }}>{s.l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.hi ? t.red : t.text }}>{s.v}</div>
              </div>
            ))}
          </div>
        )}

        {passing && (
          <div style={{ fontSize: 13, color: t.green }}>
            Max single day you can still have: <strong>{fmt(maxBestDay)}</strong>
          </div>
        )}
      </div>

      {/* Log + MLL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>

        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>Daily P&L log</div>
          <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
            <input style={{ ...inp, flex: 1, fontSize: 13 }} placeholder="Label (optional)" value={labelInput} onChange={e => setLabelInput(e.target.value)} />
            <input style={{ ...inp, width: 85, fontSize: 13 }} placeholder="P&L $" type="number" value={pnlInput} onChange={e => setPnlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDay()} />
            <button onClick={addDay} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: t.blue, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>+</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {days.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: t.muted }}>No days logged</div>
            ) : days.map((d, i) => {
              const isBest = d.pnl === bestDay && d.pnl > 0
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 11px', borderRadius: 9, background: isBest ? (dark ? '#1f1a00' : '#fef9c3') : t.faint, border: `1px solid ${isBest ? (dark ? '#7a6000' : '#fde047') : t.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {isBest && <span style={{ fontSize: 9, fontWeight: 800, color: dark ? '#fde047' : '#854d0e', background: dark ? '#3a2e00' : '#fef08a', padding: '2px 6px', borderRadius: 4 }}>BEST</span>}
                    <span style={{ fontSize: 13, color: t.text }}>{d.label || `Day ${i + 1}`}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: d.pnl >= 0 ? t.green : t.red }}>
                      {d.pnl >= 0 ? '+' : ''}{fmt(d.pnl)}
                    </span>
                    <button onClick={() => setDaysSave(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 17, padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Max loss limit</div>
          <div style={{ fontSize: 12, color: t.muted, marginBottom: 12 }}>EOD only · Floor is $48,000</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={{ background: t.faint, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: t.muted, marginBottom: 3 }}>Breach floor</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>$48,000</div>
            </div>
            <div style={{ background: mllPct < 25 ? t.redBg : mllPct < 50 ? t.amberBg : t.greenBg, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: t.muted, marginBottom: 3 }}>Buffer left</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: mllPct < 25 ? t.red : mllPct < 50 ? t.amber : t.green }}>
                {fmt(Math.max(0, mllBuffer))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: t.muted }}>Buffer remaining</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{Math.round(mllPct)}%</span>
          </div>
          <Bar value={mllBuffer} max={2000} color={mllPct < 25 ? t.red : mllPct < 50 ? t.amber : t.green} />
          <div style={{ fontSize: 12, color: mllPct < 25 ? t.red : mllPct < 50 ? t.amber : t.muted, marginTop: 10 }}>
            {mllPct <= 0 ? '⚠ Breached' : mllPct < 25 ? '⚠ Danger — cut size now' : mllPct < 50 ? 'Caution' : 'Safe'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Cumulative P&L</div>
          <div style={{ fontSize: 11, color: t.muted }}>— $3k target</div>
        </div>
        {chartData.length < 2 ? (
          <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.faint, borderRadius: 10, border: `1px dashed ${t.border}` }}>
            <span style={{ fontSize: 13, color: t.muted }}>Add 2+ days to see chart</span>
          </div>
        ) : (
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.blue} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={t.blue} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 4" stroke={t.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: t.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: t.muted }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} width={40} />
                <Tooltip content={<ChartTooltip t={t} />} />
                <ReferenceLine y={TARGET} stroke={t.green} strokeDasharray="5 4" strokeWidth={1.5} />
                <ReferenceLine y={0} stroke={t.border} />
                <Area type="monotone" dataKey="cumulative" stroke={t.blue} strokeWidth={2.5} fill="url(#cg)" dot={{ fill: t.blue, r: 3, stroke: dark ? t.card : '#fff', strokeWidth: 2 }} activeDot={{ r: 5, fill: t.blue, stroke: dark ? t.card : '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('lf-dark') === '1')
  const [users, setUsers] = useState([])
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lf-auth')) } catch { return null }
  })
  const [switchTarget, setSwitchTarget] = useState(null)

  const t = dark ? DARK : LIGHT

  useEffect(() => {
    localStorage.setItem('lf-dark', dark ? '1' : '0')
  }, [dark])

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setUsers)
  }, [])

  const handleAuth = (data) => {
    const a = { id: data.id, name: data.name }
    setAuth(a)
    setSwitchTarget(null)
    localStorage.setItem('lf-auth', JSON.stringify(a))
  }

  const handleSwitch = (user) => {
    if (user.id === auth?.id) return
    setSwitchTarget(user)
    setAuth(null)
    localStorage.removeItem('lf-auth')
  }

  if (users.length === 0) {
    return <div style={{ background: t.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}><div style={{ color: t.muted }}>Loading…</div></div>
  }

  if (!auth) {
    return <PasscodeScreen users={switchTarget ? [switchTarget] : users} onAuth={handleAuth} dark={dark} t={t} />
  }

  return (
    <Dashboard
      user={auth}
      allUsers={users}
      onSwitch={handleSwitch}
      dark={dark}
      setDark={setDark}
      t={t}
    />
  )
}
