import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const TARGET = 3000
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Helvetica, Arial, sans-serif"
const fmt   = v => (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString()
const sfmt  = v => (v >= 0 ? '+' : '') + fmt(v)

// ─── Themes ───────────────────────────────────────────────────────────────────

const DARK = {
  accent:'#7C6CF4', accent2:'#B98CF8', accentGlow:'124,108,244',
  accentGrad:'linear-gradient(135deg,#7C6CF4,#B98CF8)',
  green:'#34dda0', green2:'#1ea97c',
  greenGrad:'linear-gradient(90deg,#1ea97c,#34dda0)',
  greenDim:'rgba(52,221,160,0.10)', greenBorder:'rgba(52,221,160,0.28)',
  red:'#ff5c6e', red2:'#ff8a78',
  redGrad:'linear-gradient(90deg,#ff5c6e,#ff8a78)',
  redDim:'rgba(255,92,110,0.10)', redBorder:'rgba(255,92,110,0.28)',
  amber:'#ffb020', amberDim:'rgba(255,176,32,0.10)',
  text:'#F2F3F5', textStrong:'#e7e9ed', textSec:'#9aa0aa',
  muted:'#787e88', faint:'#565b64',
  hairline:'rgba(255,255,255,0.08)', hairlineStrong:'rgba(255,255,255,0.10)',
  surface:'rgba(255,255,255,0.025)', surfaceHover:'rgba(255,255,255,0.045)',
  inputBg:'rgba(255,255,255,0.04)',
  panelBg:'linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.012))',
  headerBg:'rgba(6,6,8,0.78)',
  pageSolid:'#08080b',
  card:'rgba(255,255,255,0.025)',
}

const LIGHT = {
  accent:'#4a52c0', accent2:'#7a4ec0', accentGlow:'74,82,192',
  accentGrad:'linear-gradient(135deg,#4a52c0,#7a4ec0)',
  green:'#2d8a5a', green2:'#1d6640',
  greenGrad:'linear-gradient(90deg,#1d6640,#2d8a5a)',
  greenDim:'rgba(45,138,90,0.10)', greenBorder:'rgba(45,138,90,0.28)',
  red:'#b04545', red2:'#c06060',
  redGrad:'linear-gradient(90deg,#b04545,#c06060)',
  redDim:'rgba(176,69,69,0.10)', redBorder:'rgba(176,69,69,0.28)',
  amber:'#a8651a', amberDim:'rgba(168,101,26,0.10)',
  text:'#2a2015', textStrong:'#1a1208', textSec:'#5a4e3a',
  muted:'#8a7d65', faint:'#a09078',
  hairline:'rgba(60,45,25,0.14)', hairlineStrong:'rgba(60,45,25,0.20)',
  surface:'rgba(60,45,25,0.05)', surfaceHover:'rgba(60,45,25,0.09)',
  inputBg:'rgba(60,45,25,0.06)',
  panelBg:'rgba(225,215,189,0.65)',
  headerBg:'rgba(216,205,176,0.88)',
  pageSolid:'#d8cdb0',
  card:'rgba(60,45,25,0.04)',
}

// ─── Glass recipe ─────────────────────────────────────────────────────────────

const glass = (t, dark, r = 24, extra = {}) => dark ? {
  borderRadius: r,
  background: t.panelBg,
  backdropFilter: 'blur(54px) saturate(165%)',
  WebkitBackdropFilter: 'blur(54px) saturate(165%)',
  border: `1px solid ${t.hairline}`,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 28px 80px -34px rgba(0,0,0,0.9)',
  overflow: 'hidden',
  position: 'relative',
  ...extra,
} : {
  borderRadius: r,
  background: t.panelBg,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: `1px solid ${t.hairline}`,
  boxShadow: '0 2px 24px rgba(0,0,0,0.08)',
  overflow: 'hidden',
  position: 'relative',
  ...extra,
}

// Top-corner light sheen on glass panels
const Sheen = () => (
  <div style={{
    position:'absolute', inset:0, pointerEvents:'none', zIndex:0,
    background:'radial-gradient(130% 70% at 0% 0%, rgba(255,255,255,0.06), transparent 50%)',
    borderRadius:'inherit',
  }}/>
)

// Gradient progress bar
function GradBar({ pct, gradient, h = 7, glow, marker }) {
  const p = Math.min(100, Math.max(0, pct || 0))
  return (
    <div style={{ position:'relative', height:h, borderRadius:99, background:'rgba(255,255,255,0.06)', overflow:'visible' }}>
      <div style={{
        width:`${p}%`, height:'100%', borderRadius:99, background:gradient,
        boxShadow: glow ? `0 0 16px rgba(${glow},0.6)` : undefined,
        transition:'width 0.6s cubic-bezier(0.16,1,0.3,1)',
      }}/>
      {marker && (
        <div style={{
          position:'absolute', top:-3, left:'50%', width:2, height:h+6,
          background:'rgba(255,255,255,0.45)', borderRadius:1, transform:'translateX(-50%)',
        }}/>
      )}
    </div>
  )
}

function StatusPill({ text, color }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'3px 10px', borderRadius:20, fontSize:11,
      fontWeight:700, letterSpacing:'0.12em', color,
      background:color+'18', border:`1px solid ${color}30`,
    }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:color }}/>
      {text}
    </span>
  )
}

function ChartTip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value ?? 0
  return (
    <div style={{
      background:'rgba(8,8,11,0.92)', border:'1px solid rgba(255,255,255,0.12)',
      borderRadius:12, padding:'10px 14px', backdropFilter:'blur(20px)',
      boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontSize:11, color:t.muted, marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:700, color:v>=0?t.green:t.red, fontVariantNumeric:'tabular-nums' }}>
        {sfmt(v)}
      </div>
    </div>
  )
}

// ─── Global CSS ───────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:${FONT};-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.10);border-radius:99px}
::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.18)}
input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
input[type=number]{-moz-appearance:textfield}
input[type=date]{color-scheme:dark}
input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5);cursor:pointer}
::selection{background:rgba(124,108,244,0.3)}
@keyframes blob1{0%{transform:translate(0,0) scale(1)}100%{transform:translate(-80px,60px) scale(1.12)}}
@keyframes blob2{0%{transform:translate(0,0) scale(1)}100%{transform:translate(70px,-50px) scale(0.9)}}
@keyframes blob3{0%{transform:translate(0,0) scale(1)}100%{transform:translate(-40px,-80px) scale(1.08)}}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
`

// ─── Ambient animated background (dark mode only) ────────────────────────────

function AmbientBg() {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:0, overflow:'hidden', pointerEvents:'none' }}>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(140% 120% at 50% -10%, #0d0d14 0%, #08080b 45%, #050507 100%)' }}/>
      <div style={{ position:'absolute', top:'-10%', left:'18%', width:620, height:520, borderRadius:'50%', background:'rgba(124,108,244,0.14)', filter:'blur(48px)', animation:'blob1 26s ease-in-out infinite alternate' }}/>
      <div style={{ position:'absolute', top:'38%', right:'-8%', width:520, height:420, borderRadius:'50%', background:'rgba(185,140,248,0.09)', filter:'blur(40px)', animation:'blob2 32s ease-in-out infinite alternate' }}/>
      <div style={{ position:'absolute', bottom:'8%', left:'42%', width:420, height:360, borderRadius:'50%', background:'rgba(52,221,160,0.07)', filter:'blur(36px)', animation:'blob3 38s ease-in-out infinite alternate' }}/>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.5) 0%, transparent 70%)' }}/>
    </div>
  )
}

// ─── Instruments ──────────────────────────────────────────────────────────────

const INSTRUMENTS = [
  { id:'ES',  name:'S&P 500',     mini:50,    micro:5,    miniLabel:'ES',  microLabel:'MES' },
  { id:'NQ',  name:'Nasdaq',       mini:20,    micro:2,    miniLabel:'NQ',  microLabel:'MNQ' },
  { id:'YM',  name:'Dow Jones',    mini:5,     micro:0.5,  miniLabel:'YM',  microLabel:'MYM' },
  { id:'RTY', name:'Russell 2000', mini:50,    micro:5,    miniLabel:'RTY', microLabel:'M2K' },
  { id:'CL',  name:'Crude Oil',    mini:1000,  micro:100,  miniLabel:'CL',  microLabel:'MCL' },
  { id:'GC',  name:'Gold',         mini:100,   micro:10,   miniLabel:'GC',  microLabel:'MGC' },
  { id:'6E',  name:'Euro FX',      mini:12.5,  micro:1.25, miniLabel:'6E',  microLabel:'M6E' },
]

// ─── Contract Calculator ──────────────────────────────────────────────────────

function ContractCalc({ t, dark, inp }) {
  const [instrument, setInstrument] = useState('NQ')
  const [sl, setSl] = useState('')
  const [risk, setRisk] = useState('')

  const inst = INSTRUMENTS.find(i => i.id === instrument)
  const slN = parseFloat(sl), riskN = parseFloat(risk)
  const valid = slN > 0 && riskN > 0

  const miniC  = valid ? Math.max(1, Math.round(riskN / (slN * inst.mini)))  : 0
  const microC = valid ? Math.max(1, Math.round(riskN / (slN * inst.micro))) : 0
  const miniR  = valid ? miniC  * slN * inst.mini  : 0
  const microR = valid ? microC * slN * inst.micro : 0

  return (
    <div style={{ ...glass(t, dark), display:'flex', flexDirection:'column' }}>
      <Sheen/>
      <div style={{ position:'relative', zIndex:1, padding:'24px 26px', display:'flex', flexDirection:'column', gap:18, flex:1 }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:17, fontWeight:650, color:t.text }}>Size Calculator</span>
          <span style={{ fontSize:12, color:t.muted }}>{inst.miniLabel} · ${inst.mini.toLocaleString()}/pt</span>
        </div>

        {/* Instrument tabs */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {INSTRUMENTS.map(i => {
            const active = instrument === i.id
            return (
              <button key={i.id} onClick={() => setInstrument(i.id)} style={{
                padding:'5px 12px', borderRadius:11, cursor:'pointer', fontFamily:FONT,
                fontSize:12, fontWeight:600, transition:'all 0.15s',
                border:`1px solid ${active ? `rgba(${t.accentGlow},0.5)` : t.hairline}`,
                background: active ? `rgba(${t.accentGlow},0.18)` : t.surface,
                color: active ? t.accent : t.muted,
              }}>{i.id}</button>
            )
          })}
        </div>

        {/* Inputs */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[{ label:'SL POINTS', val:sl, set:setSl }, { label:'RISK $', val:risk, set:setRisk }].map(({ label, val, set }) => (
            <div key={label}>
              <div style={{ fontSize:10, color:t.muted, fontWeight:700, letterSpacing:'0.15em', marginBottom:6 }}>{label}</div>
              <input
                type="number" placeholder="0" value={val} onChange={e => set(e.target.value)}
                style={{ ...inp, width:'100%', fontSize:14, padding:'11px 13px', borderRadius:12 }}
              />
            </div>
          ))}
        </div>

        {/* Result */}
        {valid ? (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { label:inst.miniLabel,  contracts:miniC,  r:miniR,  color:t.accent },
              { label:inst.microLabel, contracts:microC, r:microR, color:t.green },
            ].map(({ label, contracts, r, color }) => (
              <div key={label} style={{
                borderRadius:18, padding:'16px 18px',
                background:`rgba(${t.accentGlow},0.07)`,
                border:`1px solid rgba(${t.accentGlow},0.18)`,
              }}>
                <div style={{ fontSize:10, color:t.muted, fontWeight:700, letterSpacing:'0.15em', marginBottom:8 }}>{label}</div>
                <div style={{ fontSize:38, fontWeight:760, color, letterSpacing:-1, lineHeight:1, marginBottom:2, fontVariantNumeric:'tabular-nums' }}>{contracts}</div>
                <div style={{ fontSize:11, color:t.muted }}>contracts</div>
                <div style={{ fontSize:11, color:t.textSec, marginTop:6 }}>{fmt(r)} total risk</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 0', fontSize:13, color:t.muted, textAlign:'center' }}>
            Enter SL and risk to calculate
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Passcode Screen ──────────────────────────────────────────────────────────

function PasscodeScreen({ users, onAuth, t, dark }) {
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { if (selected && inputRef.current) inputRef.current.focus() }, [selected])

  const verify = async code => {
    setVerifying(true)
    try {
      const res = await fetch('/api/auth', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ userId:selected.id, passcode:code }),
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
    const clean = val.replace(/\D/g,'').slice(0,4)
    setPin(clean)
    if (error) setError(false)
    if (clean.length === 4) verify(clean)
  }

  const back = () => { setSelected(null); setPin(''); setError(false) }

  const Page = ({ children }) => (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', fontFamily:FONT,
      padding:24, position:'relative', overflow:'hidden',
      background: dark ? t.pageSolid : t.pageSolid,
    }}>
      <style>{GLOBAL_CSS}</style>
      {dark && <AmbientBg/>}
      {!dark && (
        <>
          <div style={{ position:'absolute', top:'-20%', left:'30%', width:480, height:400, borderRadius:'50%', background:`rgba(${t.accentGlow},0.08)`, filter:'blur(60px)', zIndex:0 }}/>
          <div style={{ position:'absolute', bottom:'5%', right:'15%', width:300, height:260, borderRadius:'50%', background:'rgba(45,138,90,0.06)', filter:'blur(48px)', zIndex:0 }}/>
        </>
      )}
      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:440, display:'flex', flexDirection:'column', alignItems:'center' }}>
        {children}
      </div>
    </div>
  )

  if (!selected) return (
    <Page>
      {/* Logo */}
      <div style={{
        width:52, height:52, borderRadius:14, background:t.accentGrad,
        display:'flex', alignItems:'center', justifyContent:'center', marginBottom:22,
        boxShadow:`0 8px 22px -6px rgba(${t.accentGlow},0.75), inset 0 1px 0 rgba(255,255,255,0.45)`,
      }}>
        <span style={{ color:'#fff', fontSize:20, fontWeight:800 }}>L</span>
      </div>
      <div style={{ fontSize:28, fontWeight:800, color:t.text, letterSpacing:-1, marginBottom:6 }}>Welcome back</div>
      <div style={{ fontSize:14, color:t.muted, marginBottom:44 }}>Select your account to continue</div>
      <div style={{ display:'flex', gap:14, width:'100%', justifyContent:'center' }}>
        {users.map((u, idx) => (
          <button key={u.id} onClick={() => setSelected(u)} style={{
            flex:'0 1 180px', padding:'32px 20px', borderRadius:22,
            ...glass(t, dark, 22),
            cursor:'pointer', textAlign:'center', fontFamily:FONT,
            animation:`fadeUp 0.4s ease ${idx*0.08}s both`,
            transition:'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
          }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = `rgba(${t.accentGlow},0.35)`
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = `0 12px 36px rgba(${t.accentGlow},0.15)`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = t.hairline
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.10), 0 28px 80px -34px rgba(0,0,0,0.9)'
            }}
          >
            <div style={{
              width:56, height:56, borderRadius:16, background:t.accentGrad,
              display:'flex', alignItems:'center', justifyContent:'center',
              margin:'0 auto 14px', fontSize:22, fontWeight:800, color:'#fff',
              boxShadow:`0 6px 18px rgba(${t.accentGlow},0.35)`,
            }}>{u.name[0].toUpperCase()}</div>
            <div style={{ fontSize:16, fontWeight:700, color:t.text, marginBottom:4 }}>{u.name}</div>
            <div style={{ fontSize:12, color:t.muted }}>$50K Evaluation</div>
          </button>
        ))}
      </div>
      <div style={{ marginTop:48, display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:5, height:5, borderRadius:'50%', background:t.green, boxShadow:`0 0 10px ${t.green}` }}/>
        <span style={{ fontSize:12, color:t.muted }}>LucidFlex $50K · Evaluation Tracker</span>
      </div>
    </Page>
  )

  return (
    <Page>
      <button onClick={back} style={{
        alignSelf:'flex-start', background:'none', border:'none', color:t.muted,
        fontSize:13, cursor:'pointer', fontFamily:FONT, marginBottom:32,
        padding:'4px 0', display:'flex', alignItems:'center', gap:6, transition:'color 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.color = t.text}
        onMouseLeave={e => e.currentTarget.style.color = t.muted}
      >
        <span style={{ fontSize:16 }}>←</span> Back
      </button>
      <div style={{ animation:'fadeUp 0.3s ease both', width:'100%', display:'flex', flexDirection:'column', alignItems:'center' }}>
        <div style={{
          width:64, height:64, borderRadius:20, background:t.accentGrad,
          display:'flex', alignItems:'center', justifyContent:'center',
          margin:'0 auto 16px', fontSize:26, fontWeight:800, color:'#fff',
          boxShadow:`0 8px 26px rgba(${t.accentGlow},0.4)`,
        }}>{selected.name[0].toUpperCase()}</div>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ fontSize:22, fontWeight:800, color:t.text, letterSpacing:-0.5, marginBottom:4 }}>{selected.name}</div>
          <div style={{ fontSize:13, color:t.textSec }}>Enter your 4-digit passcode</div>
        </div>
        <input
          ref={inputRef} type="tel" inputMode="numeric" pattern="[0-9]*"
          autoComplete="one-time-code" value={pin}
          onChange={e => handleInput(e.target.value)}
          maxLength={4} style={{ position:'absolute', opacity:0, pointerEvents:'none' }} autoFocus
        />
        <div
          onClick={() => inputRef.current?.focus()}
          style={{ display:'flex', justifyContent:'center', gap:12, marginBottom:28, animation:shake?'shake 0.4s ease':'none', cursor:'text' }}
        >
          {[0,1,2,3].map(i => {
            const filled = i < pin.length
            const active = i === pin.length && !error
            return (
              <div key={i} style={{
                width:58, height:66, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center',
                background: filled ? (error ? t.redDim : `rgba(${t.accentGlow},0.12)`) : t.inputBg,
                border:`2px solid ${error && filled ? t.red : active ? t.accent : filled ? `rgba(${t.accentGlow},0.4)` : t.hairline}`,
                boxShadow: active ? `0 0 0 4px rgba(${t.accentGlow},0.12)` : 'none',
                transition:'all 0.15s',
              }}>
                {filled ? (
                  <div style={{
                    width:12, height:12, borderRadius:'50%',
                    background:error ? t.red : t.accent,
                    boxShadow:error ? `0 0 8px ${t.red}` : `0 0 10px rgba(${t.accentGlow},0.6)`,
                    transition:'all 0.1s',
                  }}/>
                ) : active ? (
                  <div style={{ width:2, height:26, borderRadius:1, background:t.accent, animation:'pulse 1s ease infinite' }}/>
                ) : null}
              </div>
            )
          })}
        </div>
        <div style={{ textAlign:'center', height:20, marginBottom:20 }}>
          {error && <span style={{ fontSize:13, color:t.red, fontWeight:600, animation:'fadeUp 0.2s ease' }}>Wrong passcode — try again</span>}
          {verifying && !error && <span style={{ fontSize:13, color:t.muted }}>Verifying…</span>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, maxWidth:260 }}>
          {[1,2,3,4,5,6,7,8,9,null,0,'del'].map((d, i) => {
            if (d === null) return <div key={i}/>
            const isDel = d === 'del'
            return (
              <button key={i}
                onClick={() => {
                  if (isDel) { setPin(p => p.slice(0,-1)); if (error) setError(false) }
                  else handleInput(pin+String(d))
                  inputRef.current?.focus()
                }}
                style={{
                  height:54, borderRadius:14, border:`1px solid ${t.hairline}`,
                  background:t.surface, color:isDel?t.textSec:t.text,
                  fontSize:isDel?14:20, fontWeight:isDel?600:500,
                  cursor:'pointer', fontFamily:FONT, transition:'all 0.1s',
                  userSelect:'none', WebkitTapHighlightColor:'transparent',
                }}
                onMouseDown={e => { e.currentTarget.style.background = t.surfaceHover; e.currentTarget.style.transform = 'scale(0.96)' }}
                onMouseUp={e => { e.currentTarget.style.background = t.surface; e.currentTarget.style.transform = 'scale(1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = t.surface; e.currentTarget.style.transform = 'scale(1)' }}
              >{isDel ? '⌫' : d}</button>
            )
          })}
        </div>
        <div style={{ textAlign:'center', marginTop:28, fontSize:12, color:t.muted }}>Type on keyboard or tap the pad</div>
      </div>
    </Page>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ user, allUsers, onSwitch, dark, setDark, t }) {
  // ── State (identical to original) ──
  const [days, setDays] = useState([])
  const [balance, setBalance] = useState('50000')
  const [pnlInput, setPnlInput] = useState('')
  const [labelInput, setLabelInput] = useState('')
  const [dateInput, setDateInput] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [overrideActive, setOverrideActive] = useState(false)
  const [editingIdx, setEditingIdx] = useState(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [journalOpen, setJournalOpen] = useState(false)
  const [journal, setJournal] = useState([])
  const journalRef = useRef([])
  const [jName, setJName] = useState('')
  const [jOutcome, setJOutcome] = useState(null)
  const [jSide, setJSide] = useState(null)
  const [jReasoning, setJReasoning] = useState('')
  const [jLossReason, setJLossReason] = useState('')
  const [jImage, setJImage] = useState(null)
  const imageInputRef = useRef(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    fetch(`/api/data/${user.id}`).then(r => r.json()).then(d => {
      setDays(d.days || [])
      setBalance(d.balance || '50000')
      const j = d.journal || []
      setJournal(j)
      journalRef.current = j
      if (d.balance && d.balance !== '50000') setOverrideActive(true)
      setLoaded(true)
    })
  }, [user.id])

  const save = useCallback((d, b) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch(`/api/data/${user.id}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ days:d, balance:b, journal:journalRef.current }),
      })
    }, 600)
  }, [user.id])

  const setDaysSave = fn => setDays(prev => { const next = fn(prev); save(next, balance); return next })
  const setBalanceSave = v => { setBalance(v); setOverrideActive(v !== '' && v !== '50000'); save(days, v) }
  const resetData = () => {
    setDays([]); setBalance('50000'); setOverrideActive(false); setConfirmReset(false)
    fetch(`/api/data/${user.id}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ days:[], balance:'50000', journal:journalRef.current }) })
  }
  const commitRename = (idx, val) => {
    setDaysSave(prev => prev.map((tr, i) => i === idx ? { ...tr, label:val.trim() } : tr))
    setEditingIdx(null)
  }

  const clearJournalForm = () => { setJName(''); setJOutcome(null); setJSide(null); setJReasoning(''); setJLossReason(''); setJImage(null) }
  const saveJournalEntry = () => {
    if (!jName.trim()) return
    const entry = { id:Date.now(), date:new Date().toISOString().split('T')[0], name:jName.trim(), outcome:jOutcome, side:jSide, reasoning:jReasoning.trim(), lossReasoning:jOutcome==='loss'?jLossReason.trim():'', image:jImage }
    const next = [entry, ...journal]
    setJournal(next); journalRef.current = next
    fetch(`/api/data/${user.id}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ days, balance, journal:next }) })
    clearJournalForm()
  }
  const deleteJournalEntry = id => {
    const next = journal.filter(e => e.id !== id)
    setJournal(next); journalRef.current = next
    fetch(`/api/data/${user.id}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ days, balance, journal:next }) })
  }
  const handleImageUpload = e => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setJImage(ev.target.result)
    reader.readAsDataURL(file)
  }

  // ── Derived metrics (identical logic to original) ──
  const totalPnl = useMemo(() => days.reduce((s, d) => s + d.pnl, 0), [days])
  const bestTrade = useMemo(() => { const pos = days.filter(d => d.pnl > 0); return pos.length > 0 ? Math.max(...pos.map(d => d.pnl)) : 0 }, [days])

  const dailyGroups = useMemo(() => {
    const map = {}
    days.forEach((d, i) => {
      const key = d.date || 'undated'
      if (!map[key]) map[key] = { date:key, trades:[], total:0 }
      map[key].trades.push({ ...d, _idx:i })
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

  const conPct      = totalPnl > 0 && bestDayTotal > 0 ? (bestDayTotal / totalPnl) * 100 : 0
  const passing     = conPct <= 50 && totalPnl > 0
  const failing     = totalPnl > 0 && conPct > 50
  const neededMore  = failing ? Math.ceil(bestDayTotal * 2 - totalPnl) : 0
  const maxBestDay  = totalPnl > 0 ? Math.floor(totalPnl * 0.5) : 0
  const toTarget    = Math.max(0, TARGET - totalPnl)
  const progressPct = Math.min(100, Math.max(0, (totalPnl / TARGET) * 100))
  const computedBalance = 50000 + totalPnl

  const START_BAL  = 50000
  const MLL_AMOUNT = 2000
  const ITB        = START_BAL + TARGET

  const { highWaterMark, mllFloor, mllBuffer, mllLocked } = useMemo(() => {
    let hwm = START_BAL, runningBal = START_BAL
    const sorted = [...dailyGroups].sort((a, b) => a.date.localeCompare(b.date))
    for (const g of sorted) { runningBal += g.total; if (runningBal > hwm) hwm = runningBal }
    const locked = hwm >= ITB
    const floor = locked ? ITB - MLL_AMOUNT : hwm - MLL_AMOUNT
    const currentBal = overrideActive ? (parseFloat(balance) || computedBalance) : computedBalance
    const buffer = currentBal - floor
    return { highWaterMark:hwm, mllFloor:floor, mllBuffer:Math.max(0, buffer), mllLocked:locked }
  }, [dailyGroups, computedBalance, overrideActive, balance])

  const mllPct = MLL_AMOUNT > 0 ? Math.min(100, Math.max(0, (mllBuffer / MLL_AMOUNT) * 100)) : 100

  const chartData = useMemo(() => {
    let cum = 0
    return days.map((d, i) => { cum += d.pnl; return { name:d.label || `#${i+1}`, cumulative:parseFloat(cum.toFixed(2)) } })
  }, [days])

  const addTrade = () => {
    const v = parseFloat(pnlInput); if (isNaN(v)) return
    const tradeDate = dateInput || new Date().toISOString().split('T')[0]
    setDaysSave(prev => [...prev, { pnl:v, label:labelInput.trim(), date:tradeDate }])
    setPnlInput(''); setLabelInput(''); setDateInput('')
  }

  const metrics = useMemo(() => {
    if (days.length === 0) return null
    const wins   = days.filter(d => d.pnl > 0)
    const losses = days.filter(d => d.pnl < 0)
    const winRate     = (wins.length / days.length) * 100
    const avgWin      = wins.length > 0   ? wins.reduce((s, d) => s + d.pnl, 0)  / wins.length   : 0
    const avgLoss     = losses.length > 0 ? Math.abs(losses.reduce((s, d) => s + d.pnl, 0) / losses.length) : 0
    const profitFactor = avgLoss > 0 && wins.length > 0
      ? wins.reduce((s, d) => s + d.pnl, 0) / Math.abs(losses.reduce((s, d) => s + d.pnl, 0))
      : wins.length > 0 ? Infinity : 0
    const expectancy  = totalPnl / days.length
    const worstTrade  = Math.min(...days.map(d => d.pnl))
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
    return { winRate, avgWin, avgLoss, profitFactor, expectancy, worstTrade, maxDD, streak, streakType, avgRR, wins:wins.length, losses:losses.length }
  }, [days, totalPnl])

  // ── Colors ──
  const conColor  = failing ? t.red : passing ? t.green : t.accent
  const mllColor  = mllPct < 25 ? t.red : mllPct < 50 ? t.amber : t.green
  const mllGrad   = mllPct < 25 ? t.redGrad : mllPct < 50 ? `linear-gradient(90deg,${t.amber},${t.amber})` : t.greenGrad
  const chartAccent = totalPnl >= TARGET ? t.green : totalPnl < 0 ? t.red : t.accent
  const chartFrom   = totalPnl >= TARGET ? t.green2 : totalPnl < 0 ? t.red2 : t.accent2

  // ── Input style ──
  const inp = {
    padding:'11px 13px', borderRadius:12, border:`1px solid ${t.hairline}`,
    fontSize:14, color:t.text, background:t.inputBg, outline:'none',
    fontFamily:FONT, boxSizing:'border-box', transition:'border-color 0.15s',
  }
  const jInp = { ...inp, fontSize:12, padding:'8px 10px', borderRadius:8, width:'100%' }

  const displayBalance = overrideActive ? (parseFloat(balance) || computedBalance) : computedBalance

  if (!loaded) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT, background:t.pageSolid }}>
      {dark && <AmbientBg/>}
      <div style={{ position:'relative', zIndex:1, color:t.muted, fontSize:14 }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', fontFamily:FONT, color:t.text, background:dark?t.pageSolid:t.pageSolid, boxSizing:'border-box' }}>
      <style>{GLOBAL_CSS}</style>
      {dark && <AmbientBg/>}

      {/* ── Journal sidebar tab trigger ── */}
      <input ref={imageInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImageUpload}/>
      <div
        onClick={() => setJournalOpen(o => !o)}
        onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
        onMouseLeave={e => e.currentTarget.style.background = t.surface}
        style={{
          position:'fixed', zIndex:26,
          left:journalOpen ? 320 : 0,
          top:'50%', transform:'translateY(-50%)',
          width:20, height:80,
          background:t.surface,
          borderTop:`1px solid ${t.hairline}`,
          borderRight:`1px solid ${t.hairline}`,
          borderBottom:`1px solid ${t.hairline}`,
          borderRadius:'0 8px 8px 0',
          cursor:'pointer', display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:6,
          transition:'left 0.26s cubic-bezier(0.16,1,0.3,1), background 0.15s',
        }}
      >
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
          <path d={journalOpen ? 'M5 1L1 5L5 9' : 'M1 1L5 5L1 9'}
            stroke={journalOpen ? t.accent : t.muted}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition:'stroke 0.15s' }}
          />
        </svg>
        {journal.length > 0 && <span style={{ width:4, height:4, borderRadius:'50%', background:t.accent }}/>}
      </div>

      {/* ── Journal sliding panel ── */}
      <div style={{
        position:'fixed', top:0, bottom:0,
        left:journalOpen ? 0 : -320,
        width:320, zIndex:25,
        display:'flex', flexDirection:'column',
        background: dark ? 'rgba(8,8,11,0.98)' : 'rgba(219,208,182,0.98)',
        backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
        borderRight:`1px solid ${t.hairline}`,
        transition:'left 0.26s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ padding:'0 16px', height:44, borderBottom:`1px solid ${t.hairline}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontSize:13, fontWeight:700, color:t.text }}>Journal</span>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {journal.length > 0 && <span style={{ fontSize:11, color:t.muted }}>{journal.length}</span>}
            <button onClick={() => setJournalOpen(false)} style={{ background:'none', border:'none', color:t.muted, cursor:'pointer', fontSize:20, lineHeight:1, padding:'0 2px', display:'flex', alignItems:'center' }}
              onMouseEnter={e => e.currentTarget.style.color = t.text}
              onMouseLeave={e => e.currentTarget.style.color = t.muted}
            >‹</button>
          </div>
        </div>
        <div style={{ padding:'14px 16px', borderBottom:`1px solid ${t.hairline}`, display:'flex', flexDirection:'column', gap:9, flexShrink:0 }}>
          <input style={jInp} placeholder="Trade name" value={jName} onChange={e => setJName(e.target.value)}/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {['win','loss'].map(o => (
              <button key={o} onClick={() => setJOutcome(jOutcome===o?null:o)} style={{
                padding:'7px 0', borderRadius:8, cursor:'pointer', fontFamily:FONT,
                fontSize:12, fontWeight:600, transition:'all 0.15s',
                border:`1px solid ${jOutcome===o?(o==='win'?t.greenBorder:t.redBorder):t.hairline}`,
                background:jOutcome===o?(o==='win'?t.greenDim:t.redDim):'transparent',
                color:jOutcome===o?(o==='win'?t.green:t.red):t.muted,
              }}>{o==='win'?'Win':'Loss'}</button>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {['long','short'].map(s => (
              <button key={s} onClick={() => setJSide(jSide===s?null:s)} style={{
                padding:'7px 0', borderRadius:8, cursor:'pointer', fontFamily:FONT,
                fontSize:12, fontWeight:600, transition:'all 0.15s',
                border:`1px solid ${jSide===s?`rgba(${t.accentGlow},0.4)`:t.hairline}`,
                background:jSide===s?`rgba(${t.accentGlow},0.12)`:'transparent',
                color:jSide===s?t.accent:t.muted,
              }}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>
            ))}
          </div>
          <div
            onClick={() => imageInputRef.current?.click()}
            onMouseEnter={e => e.currentTarget.style.borderColor = `rgba(${t.accentGlow},0.4)`}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.hairline}
            style={{ borderRadius:8, border:`1px dashed ${t.hairline}`, cursor:'pointer', overflow:'hidden', transition:'border-color 0.15s', minHeight:jImage?0:58, display:'flex', alignItems:'center', justifyContent:'center' }}
          >
            {jImage ? (
              <div style={{ position:'relative', width:'100%' }}>
                <img src={jImage} alt="" style={{ width:'100%', display:'block', maxHeight:130, objectFit:'cover' }}/>
                <button onClick={e => { e.stopPropagation(); setJImage(null) }} style={{ position:'absolute', top:5, right:5, width:20, height:20, background:'rgba(0,0,0,0.65)', border:'none', borderRadius:'50%', color:'#fff', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>×</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'10px 0' }}>
                <span style={{ fontSize:20, color:t.muted, lineHeight:1 }}>+</span>
                <span style={{ fontSize:10, color:t.muted }}>Add screenshot</span>
              </div>
            )}
          </div>
          <textarea placeholder="Trade reasoning…" value={jReasoning} onChange={e => setJReasoning(e.target.value)} style={{ ...jInp, resize:'vertical', minHeight:70, lineHeight:1.55 }}/>
          {jOutcome==='loss' && (
            <textarea placeholder="What went wrong?" value={jLossReason} onChange={e => setJLossReason(e.target.value)} style={{ ...jInp, resize:'vertical', minHeight:56, lineHeight:1.55, borderColor:t.redBorder }}/>
          )}
          <div style={{ display:'flex', gap:7 }}>
            <button onClick={saveJournalEntry} style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', background:t.accentGrad, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:FONT }}>Save</button>
            <button onClick={clearJournalForm} style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${t.hairline}`, background:'transparent', color:t.muted, fontSize:12, cursor:'pointer', fontFamily:FONT }}>Clear</button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
          {journal.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', fontSize:12, color:t.muted }}>No entries yet</div>
          ) : journal.map(entry => (
            <div key={entry.id} style={{ marginBottom:10, background:t.card, border:`1px solid ${t.hairline}`, borderRadius:10, padding:'12px 13px', backdropFilter:'blur(12px)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:7 }}>
                <span style={{ fontSize:13, fontWeight:600, color:t.text, flex:1, marginRight:8 }}>{entry.name}</span>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                  <span style={{ fontSize:10, color:t.muted }}>{entry.date}</span>
                  <button onClick={() => deleteJournalEntry(entry.id)} style={{ background:'none', border:'none', cursor:'pointer', color:t.muted, fontSize:14, padding:0, lineHeight:1, opacity:0.4 }}
                    onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.color=t.red }}
                    onMouseLeave={e => { e.currentTarget.style.opacity='0.4'; e.currentTarget.style.color=t.muted }}
                  >×</button>
                </div>
              </div>
              <div style={{ display:'flex', gap:5, marginBottom:(entry.reasoning||entry.image||entry.lossReasoning)?8:0, flexWrap:'wrap' }}>
                {entry.outcome && <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, background:entry.outcome==='win'?t.greenDim:t.redDim, color:entry.outcome==='win'?t.green:t.red, border:`1px solid ${entry.outcome==='win'?t.greenBorder:t.redBorder}` }}>{entry.outcome.toUpperCase()}</span>}
                {entry.side && <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, background:`rgba(${t.accentGlow},0.12)`, color:t.accent, border:`1px solid rgba(${t.accentGlow},0.25)` }}>{entry.side.toUpperCase()}</span>}
              </div>
              {entry.image && <img src={entry.image} alt="" style={{ width:'100%', borderRadius:6, marginBottom:7, maxHeight:100, objectFit:'cover', display:'block' }}/>}
              {entry.reasoning && <p style={{ margin:'0 0 5px', fontSize:11, color:t.textSec, lineHeight:1.55 }}>{entry.reasoning}</p>}
              {entry.lossReasoning && <p style={{ margin:0, fontSize:11, color:t.red, opacity:0.85, lineHeight:1.5 }}>↳ {entry.lossReasoning}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Header ── */}
      <header style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'12px 24px', borderBottom:`1px solid ${t.hairline}`,
        background:t.headerBg, backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
        position:'sticky', top:0, zIndex:20,
      }}>
        {/* Logo + wordmark */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{
            width:38, height:38, borderRadius:12, background:t.accentGrad,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:`0 8px 22px -6px rgba(${t.accentGlow},0.75), inset 0 1px 0 rgba(255,255,255,0.45)`,
          }}>
            <span style={{ color:'#fff', fontSize:16, fontWeight:800 }}>L</span>
          </div>
          <div>
            <span style={{ fontSize:16, fontWeight:650, color:t.text }}>LucidFlex</span>
            <span style={{ fontSize:14, color:t.faint, fontWeight:400 }}> · $50K</span>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          {/* Segmented account toggle */}
          <div style={{
            display:'flex', alignItems:'center', padding:3, borderRadius:13,
            background:'rgba(255,255,255,0.045)', border:`1px solid rgba(255,255,255,0.07)`,
            backdropFilter:'blur(14px)',
          }}>
            {allUsers.map(u => {
              const active = u.id === user.id
              return (
                <button key={u.id} onClick={() => onSwitch(u)} style={{
                  padding:'7px 17px', borderRadius:10, border:'none', cursor:'pointer',
                  fontFamily:FONT, fontSize:13, fontWeight:600, transition:'all 0.15s',
                  color: active ? t.text : t.muted,
                  background: active
                    ? 'linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06))'
                    : 'transparent',
                  boxShadow: active
                    ? 'inset 0 1px 0 rgba(255,255,255,0.28), 0 2px 8px -2px rgba(0,0,0,0.5)'
                    : 'none',
                }}>{u.name}</button>
              )
            })}
          </div>

          {/* Theme toggle */}
          <button onClick={() => setDark(d => !d)} style={{
            width:34, height:34, borderRadius:10, border:`1px solid ${t.hairline}`,
            background:t.surface, color:t.muted, fontSize:15, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = t.text}
            onMouseLeave={e => e.currentTarget.style.color = t.muted}
          >{dark ? '☀' : '☾'}</button>

          <div style={{ width:1, height:22, background:'rgba(255,255,255,0.10)' }}/>

          {/* Reset */}
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} style={{ height:34, padding:'0 12px', borderRadius:8, border:'none', background:'transparent', color:t.muted, fontSize:13, cursor:'pointer', fontFamily:FONT, transition:'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = t.text}
              onMouseLeave={e => e.currentTarget.style.color = t.muted}
            >Reset</button>
          ) : (
            <>
              <button onClick={resetData} style={{ height:34, padding:'0 12px', borderRadius:8, border:'none', background:t.redDim, color:t.red, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:FONT }}>Confirm</button>
              <button onClick={() => setConfirmReset(false)} style={{ height:34, padding:'0 10px', borderRadius:8, border:'none', background:'transparent', color:t.muted, fontSize:13, cursor:'pointer', fontFamily:FONT }}>Cancel</button>
            </>
          )}
        </div>
      </header>

      {/* ── Main content column ── */}
      <div style={{ position:'relative', zIndex:1, maxWidth:1100, margin:'0 auto', padding:'28px 72px 90px', zoom:0.9 }}>

        {/* ── 1. Balance Hero ── */}
        <div style={{ padding:'2px 2px 30px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
            <div>
              <div style={{ fontSize:11, color:t.faint, fontWeight:650, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:8 }}>Account Balance</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
                <span style={{ fontSize:62, fontWeight:760, letterSpacing:'-0.03em', lineHeight:1, fontVariantNumeric:'tabular-nums', color:t.textStrong }}>
                  ${displayBalance.toLocaleString(undefined, { maximumFractionDigits:0 })}
                </span>
                <span style={{ fontSize:22, fontWeight:700, color:totalPnl>=0?t.green:t.red, letterSpacing:-0.3 }}>
                  {sfmt(totalPnl)}
                </span>
              </div>
            </div>
            {/* Balance override */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10 }}>
              <span style={{ fontSize:11, color:t.muted }}>Override</span>
              <input
                style={{ ...inp, width:110, fontSize:12, padding:'6px 10px', borderRadius:11 }}
                type="number" placeholder="auto"
                value={overrideActive ? balance : ''}
                onChange={e => setBalanceSave(e.target.value)}
              />
              {overrideActive && (
                <button onClick={() => { setOverrideActive(false); setBalance('50000'); save(days,'50000') }}
                  style={{ background:'none', border:'none', color:t.muted, fontSize:13, cursor:'pointer', fontFamily:FONT }}>×</button>
              )}
            </div>
          </div>

          {/* Target progress bar */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:14, color:t.muted }}>
                Target progress · <span style={{ color:t.text, fontWeight:600 }}>{Math.round(progressPct)}%</span>
              </span>
              <span style={{ fontSize:13.5, color:t.muted }}>
                {totalPnl >= TARGET
                  ? <span style={{ color:t.green, fontWeight:600 }}>Target hit ✓</span>
                  : <span>{fmt(toTarget)} to <span style={{ color:t.text, fontWeight:600 }}>${TARGET.toLocaleString()}</span></span>
                }
              </span>
            </div>
            <GradBar
              pct={progressPct}
              gradient={totalPnl>=TARGET ? t.greenGrad : t.accentGrad}
              h={7}
              glow={totalPnl>=TARGET ? '52,221,160' : t.accentGlow}
            />
          </div>
        </div>

        {/* ── 2. Limits row — one glass panel, two halves ── */}
        <div style={{ ...glass(t, dark), display:'grid', gridTemplateColumns:'1fr 1px 1fr', marginBottom:22 }}>
          <Sheen/>

          {/* Consistency */}
          <div style={{ position:'relative', zIndex:1, padding:'26px 30px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:17, fontWeight:650, color:t.text }}>Consistency</span>
              {totalPnl > 0 && <StatusPill text={failing?'FAILING':'PASSING'} color={failing?t.red:t.green}/>}
            </div>
            <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:14 }}>
              <span style={{ fontSize:40, fontWeight:740, color:conColor, fontVariantNumeric:'tabular-nums', letterSpacing:-0.5 }}>
                {totalPnl > 0 ? `${conPct.toFixed(1)}%` : '—'}
              </span>
              <span style={{ fontSize:14, color:t.muted }}>of 50% cap</span>
            </div>
            <div style={{ marginBottom:14 }}>
              <GradBar pct={conPct} gradient={failing?t.redGrad:`linear-gradient(90deg,${conColor},${conColor})`} h={6} marker/>
            </div>
            <div style={{ fontSize:13.5, color:t.muted }}>
              {failing && <>Earn <span style={{ color:t.red, fontWeight:600 }}>{fmt(neededMore)}</span> more across other days · cap each day at <span style={{ color:t.text, fontWeight:600 }}>{fmt(bestDayTotal)}</span></>}
              {passing && <>Max single day: <span style={{ color:t.text, fontWeight:600 }}>{fmt(maxBestDay)}</span></>}
              {totalPnl <= 0 && 'Log trades to track'}
            </div>
          </div>

          {/* 1px divider */}
          <div style={{ background:'rgba(255,255,255,0.07)', zIndex:1 }}/>

          {/* Max Loss Limit */}
          <div style={{ position:'relative', zIndex:1, padding:'26px 30px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:17, fontWeight:650, color:t.text }}>Max Loss Limit</span>
              <StatusPill text={mllPct<25?'BREACH':mllPct<50?'CAUTION':'SAFE'} color={mllColor}/>
            </div>
            <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:14 }}>
              <span style={{ fontSize:40, fontWeight:740, color:mllColor, fontVariantNumeric:'tabular-nums', letterSpacing:-0.5 }}>
                {fmt(mllBuffer)}
              </span>
              <span style={{ fontSize:14, color:t.muted }}>buffer</span>
            </div>
            <div style={{ marginBottom:14 }}>
              <GradBar pct={mllPct} gradient={mllGrad} h={6}/>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13.5, color:t.muted }}>
              <span>Floor <span style={{ color:t.text, fontWeight:600 }}>${mllFloor.toLocaleString()}</span></span>
              <span>Peak <span style={{ color:t.text, fontWeight:600 }}>${highWaterMark.toLocaleString()}</span></span>
            </div>
          </div>
        </div>

        {/* ── 3. Equity Curve + Stats ── */}
        <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1.62fr) minmax(220px,1fr)', gap:22, marginBottom:22 }}>

          {/* Equity Curve */}
          <div style={{ ...glass(t, dark), display:'flex', flexDirection:'column' }}>
            <Sheen/>
            <div style={{ position:'relative', zIndex:1, padding:'24px 26px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:17, fontWeight:650, color:t.text, marginBottom:4 }}>Equity Curve</div>
                <div style={{ fontSize:13, color:t.muted }}>
                  Last: <span style={{ color:totalPnl>=0?t.green:t.red, fontWeight:600 }}>{sfmt(totalPnl)}</span>
                  <span style={{ margin:'0 8px', color:t.hairline }}>·</span>
                  Peak: <span style={{ color:t.text, fontWeight:600 }}>{fmt(Math.max(0, ...chartData.map(d => d.cumulative), 0))}</span>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:14, fontSize:11, color:t.muted }}>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:16, height:3, background:t.accent, borderRadius:2, display:'inline-block' }}/>
                  Equity
                </span>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:16, borderTop:`1.5px dashed ${t.green}`, display:'inline-block' }}/>
                  Target
                </span>
              </div>
            </div>
            <div style={{ position:'relative', zIndex:1, flex:1, minHeight:280, padding:'0 8px 16px' }}>
              {chartData.length < 2 ? (
                <div style={{ height:280, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:t.muted }}>
                  Add 2+ trades to see the curve
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top:18, right:24, left:8, bottom:4 }}>
                    <defs>
                      <linearGradient id="cgFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={chartAccent} stopOpacity={0.45}/>
                        <stop offset="40%"  stopColor={chartAccent} stopOpacity={0.15}/>
                        <stop offset="100%" stopColor={chartAccent} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="cgStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={chartFrom}   stopOpacity={0.8}/>
                        <stop offset="100%" stopColor={chartAccent}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke={t.hairline} vertical={false} strokeOpacity={0.7}/>
                    <XAxis dataKey="name" tick={{ fontSize:10, fill:t.muted, fontFamily:FONT }} axisLine={false} tickLine={false} dy={6}/>
                    <YAxis
                      tick={{ fontSize:10, fill:t.muted, fontFamily:FONT }}
                      axisLine={false} tickLine={false} width={46} dx={-4}
                      tickFormatter={v => { const a=Math.abs(v), s=v<0?'-':''; return a>=1000?`${s}$${(a/1000).toFixed(1)}k`:`${s}$${a}` }}
                      domain={[dataMin => Math.min(0, Math.floor(dataMin*1.15)), dataMax => Math.ceil(Math.max(dataMax,TARGET)*1.10)]}
                    />
                    <Tooltip content={<ChartTip t={t}/>} cursor={{ stroke:t.muted, strokeWidth:1, strokeDasharray:'3 3', strokeOpacity:0.4 }}/>
                    {/* Glow halo */}
                    <Area type="monotone" dataKey="cumulative" stroke={chartAccent} strokeWidth={7} fill="none" dot={false} activeDot={false} strokeOpacity={0.14}/>
                    {/* Main line */}
                    <Area
                      type="monotone" dataKey="cumulative"
                      stroke="url(#cgStroke)" strokeWidth={3.4} fill="url(#cgFill)"
                      dot={(props) => {
                        const { cx, cy, index } = props
                        if (index !== chartData.length-1) return null
                        return (
                          <g key="endDot">
                            <circle cx={cx} cy={cy} r={11} fill={chartAccent} opacity={0.18}/>
                            <circle cx={cx} cy={cy} r={5.5} fill={chartAccent} stroke="#0a0a0d" strokeWidth={2}/>
                          </g>
                        )
                      }}
                      activeDot={{ r:7, fill:chartAccent, stroke:'#0a0a0d', strokeWidth:2.5 }}
                    />
                    <ReferenceLine y={TARGET} stroke={t.green} strokeDasharray="6 4" strokeWidth={1.5} strokeOpacity={0.85} label={{ value:'$3k', position:'right', fill:t.green, fontSize:10, fontWeight:600, offset:6 }}/>
                    <ReferenceLine y={0} stroke={t.hairline} strokeWidth={1}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Stats panel */}
          <div style={{ ...glass(t, dark), display:'flex', flexDirection:'column' }}>
            <Sheen/>
            <div style={{ position:'relative', zIndex:1, padding:'24px 26px 16px', borderBottom:`1px solid ${t.hairline}` }}>
              <span style={{ fontSize:17, fontWeight:650, color:t.text }}>Stats</span>
            </div>
            {!metrics ? (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 20px', fontSize:13, color:t.muted, textAlign:'center', position:'relative', zIndex:1 }}>
                Log trades to see stats
              </div>
            ) : (
              <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', flex:1 }}>
                {[
                  { l:'Win rate', v:`${metrics.winRate.toFixed(0)}%`, sub:`${metrics.wins}W / ${metrics.losses}L`, c:metrics.winRate>=50?t.green:t.red },
                  { l:'Profit factor', v:metrics.profitFactor===Infinity?'∞':metrics.profitFactor.toFixed(2), sub:'gross win ÷ loss', c:metrics.profitFactor>=1.5?t.green:metrics.profitFactor>=1?t.amber:t.red },
                  { l:'Avg R:R', v:metrics.avgRR>0?metrics.avgRR.toFixed(2):'—', sub:'avg win ÷ avg loss', c:metrics.avgRR>=1.5?t.green:metrics.avgRR>=1?t.text:t.red },
                  { l:'Expectancy', v:(metrics.expectancy>=0?'+':'')+fmt(metrics.expectancy), sub:'per trade', c:metrics.expectancy>=0?t.green:t.red },
                  { l:'Max drawdown', v:fmt(metrics.maxDD), sub:'peak to trough', c:metrics.maxDD>1000?t.red:metrics.maxDD>500?t.amber:t.text },
                  { l:'Best / Worst', v:`${sfmt(bestTrade)} / ${fmt(metrics.worstTrade)}`, sub:'single trade', c:t.text, small:true },
                  { l:'Streak', v:`${metrics.streak}${metrics.streakType?'W':'L'}`, sub:'current run', c:metrics.streakType?t.green:t.red },
                ].map((s, i) => (
                  <div key={i} style={{ padding:'15px 26px', borderTop:`1px solid ${t.hairline}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:14.5, color:t.text, fontWeight:600 }}>{s.l}</div>
                      <div style={{ fontSize:12.5, color:t.muted, marginTop:1 }}>{s.sub}</div>
                    </div>
                    <span style={{ fontSize:s.small?13:19, fontWeight:720, color:s.c, fontVariantNumeric:'tabular-nums', letterSpacing:-0.3, whiteSpace:'nowrap' }}>{s.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 4. Trade Log + Size Calculator ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:22 }}>

          {/* Trade Log */}
          <div style={{ ...glass(t, dark), display:'flex', flexDirection:'column' }}>
            <Sheen/>
            <div style={{ position:'relative', zIndex:1, padding:'24px 26px 0', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:17, fontWeight:650, color:t.text }}>Trade Log</span>
              <span style={{ fontSize:13, color:t.muted }}>{days.length} trades · {tradingDays} days</span>
            </div>

            {/* Add trade row */}
            <div style={{ position:'relative', zIndex:1, padding:'0 26px 16px', display:'flex', gap:8, flexWrap:'wrap' }}>
              <input
                style={{ ...inp, flex:'1 1 120px', fontSize:13, padding:'11px 13px', minWidth:0 }}
                placeholder="e.g. NQ long" value={labelInput} onChange={e => setLabelInput(e.target.value)}
              />
              <input
                style={{ ...inp, width:100, fontSize:13, padding:'11px 13px' }}
                placeholder="$" type="number" value={pnlInput}
                onChange={e => setPnlInput(e.target.value)}
                onKeyDown={e => e.key==='Enter' && addTrade()}
              />
              <input
                style={{ ...inp, width:148, fontSize:12, padding:'11px 13px' }}
                type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
              />
              <button onClick={addTrade} style={{
                padding:'11px 18px', borderRadius:12, border:'none', cursor:'pointer',
                background:t.accentGrad, color:'#fff', fontWeight:600, fontSize:13, fontFamily:FONT,
                boxShadow:`0 8px 22px -8px rgba(${t.accentGlow},0.8), inset 0 1px 0 rgba(255,255,255,0.35)`,
                transition:'filter 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.filter='brightness(1.12)'}
                onMouseLeave={e => e.currentTarget.style.filter='none'}
              >Add</button>
            </div>

            {/* Trade list */}
            <div style={{ position:'relative', zIndex:1, padding:'0 26px 24px', maxHeight:420, overflowY:'auto', flex:1 }}>
              {days.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0', fontSize:13, color:t.muted }}>No trades yet</div>
              ) : (
                [...dailyGroups].reverse().map(group => {
                  const isBestDay = group.date === bestDayDate && bestDayTotal > 0
                  const d = group.date !== 'undated' ? new Date(group.date+'T12:00:00') : null
                  const dayLabel = d ? d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) : 'Undated'
                  return (
                    <div key={group.date} style={{ marginBottom:14 }}>
                      {/* Day header */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:8, borderBottom:`1px solid ${t.hairline}`, marginBottom:6 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {isBestDay && <span style={{ fontSize:9, fontWeight:700, color:t.amber, letterSpacing:0.5 }}>★ BEST</span>}
                          <span style={{ fontSize:13, fontWeight:600, color:t.text }}>{dayLabel}</span>
                          <span style={{ fontSize:11, color:t.muted, background:t.surface, padding:'1px 7px', borderRadius:20 }}>{group.trades.length}</span>
                        </div>
                        <span style={{ fontSize:14, fontWeight:700, color:group.total>=0?t.green:t.red, fontVariantNumeric:'tabular-nums' }}>
                          {group.total>=0?'+':''}{fmt(group.total)}
                        </span>
                      </div>

                      {/* Trade pills */}
                      {group.trades.map(td => (
                        <div key={td._idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 13px', borderRadius:13, background:t.surface, border:`1px solid ${t.hairline}`, marginBottom:6 }}>
                          {editingIdx === td._idx ? (
                            <input
                              autoFocus value={editingLabel}
                              onChange={e => setEditingLabel(e.target.value)}
                              onBlur={() => commitRename(td._idx, editingLabel)}
                              onKeyDown={e => {
                                if (e.key==='Enter') commitRename(td._idx, editingLabel)
                                if (e.key==='Escape') setEditingIdx(null)
                              }}
                              style={{ ...inp, fontSize:12, padding:'3px 8px', flex:1, marginRight:8 }}
                            />
                          ) : (
                            <span
                              onClick={() => { setEditingIdx(td._idx); setEditingLabel(td.label||'') }}
                              style={{ fontSize:13, color:t.textSec, cursor:'text', flex:1 }}
                              title="Click to rename"
                            >{td.label||'Trade'}</span>
                          )}
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ fontSize:13, fontWeight:600, color:td.pnl>=0?t.green:t.red, fontVariantNumeric:'tabular-nums' }}>
                              {td.pnl>=0?'+':''}{fmt(td.pnl)}
                            </span>
                            <button
                              onClick={() => setDaysSave(p => p.filter((_,j) => j!==td._idx))}
                              style={{ width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'none', cursor:'pointer', color:t.muted, fontSize:14, padding:0, lineHeight:1, borderRadius:6, opacity:0.45, transition:'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.color=t.red; e.currentTarget.style.background=t.redDim }}
                              onMouseLeave={e => { e.currentTarget.style.opacity='0.45'; e.currentTarget.style.color=t.muted; e.currentTarget.style.background='none' }}
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

          {/* Size Calculator */}
          <ContractCalc t={t} dark={dark} inp={inp}/>
        </div>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(() => {
    const v = localStorage.getItem('lf-dark')
    return v === null ? true : v === '1'
  })
  const [users, setUsers] = useState([])
  const [auth, setAuth] = useState(() => { try { return JSON.parse(localStorage.getItem('lf-auth')) } catch { return null } })
  const [switchTarget, setSwitchTarget] = useState(null)
  const t = dark ? DARK : LIGHT

  useEffect(() => { localStorage.setItem('lf-dark', dark ? '1' : '0') }, [dark])
  useEffect(() => { fetch('/api/users').then(r => r.json()).then(setUsers) }, [])

  useEffect(() => { document.body.style.background = dark ? '#08080b' : '#d8cdb0' }, [dark])

  const handleAuth   = data => { const a = { id:data.id, name:data.name }; setAuth(a); setSwitchTarget(null); localStorage.setItem('lf-auth', JSON.stringify(a)) }
  const handleSwitch = user => { if (user.id === auth?.id) return; setSwitchTarget(user); setAuth(null); localStorage.removeItem('lf-auth') }

  if (users.length === 0) return (
    <div style={{ background:t.pageSolid, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT }}>
      <style>{GLOBAL_CSS}</style>
      {dark && <AmbientBg/>}
      <div style={{ position:'relative', zIndex:1, color:t.muted, fontSize:14 }}>Loading…</div>
    </div>
  )
  if (!auth) return <PasscodeScreen users={switchTarget ? [switchTarget] : users} onAuth={handleAuth} t={t} dark={dark}/>
  return <Dashboard user={auth} allUsers={users} onSwitch={handleSwitch} dark={dark} setDark={setDark} t={t}/>
}
