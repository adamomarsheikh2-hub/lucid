import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())

// Data file — on Railway mount a Volume at /data
const DATA_FILE = process.env.DATA_PATH || path.join(__dirname, 'data', 'db.json')

const USERS = [
  {
    id: 'user1',
    name: process.env.USER1_NAME || 'User 1',
    passcode: process.env.USER1_PASS || '1111',
  },
  {
    id: 'user2',
    name: process.env.USER2_NAME || 'User 2',
    passcode: process.env.USER2_PASS || '2222',
  },
]

function readDB() {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}))
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function writeDB(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

// --- API ---

// List users (names only, no passcodes)
app.get('/api/users', (req, res) => {
  res.json(USERS.map(u => ({ id: u.id, name: u.name })))
})

// Verify passcode
app.post('/api/auth', (req, res) => {
  const { userId, passcode } = req.body
  const user = USERS.find(u => u.id === userId)
  if (!user || String(user.passcode) !== String(passcode)) {
    return res.status(401).json({ error: 'Wrong passcode' })
  }
  res.json({ success: true, id: user.id, name: user.name })
})

// Get user data
app.get('/api/data/:userId', (req, res) => {
  const db = readDB()
  res.json(db[req.params.userId] || { days: [], balance: '50000' })
})

// Save user data
app.post('/api/data/:userId', (req, res) => {
  const db = readDB()
  db[req.params.userId] = req.body
  writeDB(db)
  res.json({ success: true })
})

// Economic calendar — proxy ForexFactory JSON feed, cache 5 min
let calCache = { data: null, ts: 0 }

const safeJson = async url => {
  try {
    const r = await fetch(url)
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

app.get('/api/calendar', async (_req, res) => {
  const now = Date.now()
  if (calCache.data && now - calCache.ts < 5 * 60 * 1000) return res.json(calCache.data)
  try {
    const TZ = 'timezone=America%2FNew_York'
    const [tw, nw] = await Promise.all([
      safeJson(`https://nfs.faireconomy.media/ff_calendar_thisweek.json?${TZ}`),
      safeJson(`https://nfs.faireconomy.media/ff_calendar_nextweek.json?${TZ}`),
    ])
    const filtered = [...tw, ...nw]
      .filter(e => e.country === 'USD' && (e.impact === 'High' || e.impact === 'Medium'))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
    calCache = { data: filtered, ts: now }
    res.json(filtered)
  } catch (err) {
    console.error('Calendar error:', err.message)
    if (calCache.data) return res.json(calCache.data)
    res.status(502).json({ error: 'Calendar unavailable' })
  }
})

// Serve built frontend
app.use(express.static(path.join(__dirname, 'client', 'dist')))
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Listening on ${PORT}`))
