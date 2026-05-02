import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, ChevronRight, ChevronLeft, Settings, X } from 'lucide-react'

// ─── Physics ─────────────────────────────────────────────────────────────────
const R = 8.314

function carnotEfficiency(TH: number, TC: number) {
  return TH > TC ? 1 - TC / TH : 0
}

function qH(n: number, TH: number, V1: number, V2: number) {
  return n * R * TH * Math.log(V2 / V1)
}

function qC(n: number, TC: number, V1: number, V2: number) {
  return n * R * TC * Math.log(V2 / V1)
}

// ─── Carnot cycle phases ──────────────────────────────────────────────────────
const PHASES = [
  {
    id: 0,
    label: '1 → 2',
    name: 'Isothermal Expansion',
    color: '#E8593C',
    colorMid: '#F0875A',
    colorLight: '#FDE8E0',
    description: 'Gas absorbs heat Q_H from the hot reservoir at constant temperature T_H. It expands, pushing the piston down and doing work on the surroundings.',
    thermal: 'contact-hot',
    pistonDir: 'down',
    heatFlow: 'in',
  },
  {
    id: 1,
    label: '2 → 3',
    name: 'Adiabatic Expansion',
    color: '#7C5CBF',
    colorMid: '#9B7DD4',
    colorLight: '#EDE8F7',
    description: 'The cylinder is insulated — no heat exchange. Gas continues expanding, doing work while its temperature drops from T_H down to T_C.',
    thermal: 'insulated',
    pistonDir: 'down',
    heatFlow: 'none',
  },
  {
    id: 2,
    label: '3 → 4',
    name: 'Isothermal Compression',
    color: '#2E7DD4',
    colorMid: '#4D96E8',
    colorLight: '#E0EDFC',
    description: 'Gas rejects heat Q_C to the cold reservoir at constant temperature T_C. Work is done on the gas, compressing it.',
    thermal: 'contact-cold',
    pistonDir: 'up',
    heatFlow: 'out',
  },
  {
    id: 3,
    label: '4 → 1',
    name: 'Adiabatic Compression',
    color: '#1B9E6E',
    colorMid: '#35B885',
    colorLight: '#E0F5EE',
    description: 'Cylinder is insulated again. Gas is compressed and its temperature rises from T_C back to T_H, completing the cycle.',
    thermal: 'insulated',
    pistonDir: 'up',
    heatFlow: 'none',
  },
]

// ─── Particle system ──────────────────────────────────────────────────────────
interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
  opacity: number
  hue: number
}

function createParticles(count: number, gasBottom: number, gasTop: number, cylLeft: number, cylRight: number, phase: number): Particle[] {
  const phaseHues = [20, 280, 210, 160]
  const hue = phaseHues[phase]
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: cylLeft + Math.random() * (cylRight - cylLeft),
    y: gasTop + Math.random() * (gasBottom - gasTop),
    vx: (Math.random() - 0.5) * 1.4,
    vy: (Math.random() - 0.5) * 1.4,
    r: 1.5 + Math.random() * 2,
    opacity: 0.15 + Math.random() * 0.35,
    hue,
  }))
}

// ─── Piston geometry helpers ──────────────────────────────────────────────────
const CYL_LEFT = 148
const CYL_RIGHT = 332
const CYL_WIDTH = CYL_RIGHT - CYL_LEFT
const CYL_TOP = 60
const CYL_BOT = 320
const PISTON_H = 20
const CRANK_CX = 440
const CRANK_CY = 200
const CRANK_R = 62
const ROD_LEN = 118
const CYL_MID = (CYL_LEFT + CYL_RIGHT) / 2

function pistonY(angle: number): number {
  const cpX = CRANK_CX + CRANK_R * Math.cos(angle)
  const cpY = CRANK_CY + CRANK_R * Math.sin(angle)
  const dx = CYL_MID - cpX
  return cpY - Math.sqrt(Math.max(0, ROD_LEN * ROD_LEN - dx * dx))
}

// ─── Settings panel ───────────────────────────────────────────────────────────
interface SettingsPanelProps {
  TH: number; TC: number; n: number; V1: number; V2: number
  setTH: (v: number) => void; setTC: (v: number) => void
  setN: (v: number) => void; setV1: (v: number) => void; setV2: (v: number) => void
  onClose: () => void
}

function SettingsPanel({ TH, TC, n, V1, V2, setTH, setTC, setN, setV1, setV2, onClose }: SettingsPanelProps) {
  const sliders = [
    { label: 'Hot reservoir T_H', unit: 'K', value: TH, set: setTH, min: 400, max: 1500, step: 10, color: '#E8593C' },
    { label: 'Cold reservoir T_C', unit: 'K', value: TC, set: setTC, min: 50, max: 399, step: 10, color: '#2E7DD4' },
    { label: 'Moles of gas n', unit: 'mol', value: n, set: setN, min: 0.1, max: 5, step: 0.1, color: '#7C5CBF' },
    { label: 'Min volume V₁', unit: 'L', value: V1, set: setV1, min: 0.1, max: 3, step: 0.1, color: '#1B9E6E' },
    { label: 'Max volume V₂', unit: 'L', value: V2, set: setV2, min: 1, max: 10, step: 0.5, color: '#1B9E6E' },
  ]
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      className="absolute top-16 right-4 z-50 w-80 rounded-2xl border border-gray-100 dark:border-white/10 bg-white/95 dark:bg-[#16213e]/95 backdrop-blur-xl shadow-2xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-gray-800 dark:text-white tracking-tight">Parameters</span>
        <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
          <X size={14} className="text-gray-400" />
        </button>
      </div>
      <div className="space-y-4">
        {sliders.map(s => (
          <div key={s.label}>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{s.label}</span>
              <span className="text-xs font-bold font-mono" style={{ color: s.color }}>{s.value} {s.unit}</span>
            </div>
            <input
              type="range" min={s.min} max={s.max} step={s.step} value={s.value}
              onChange={e => s.set(parseFloat(e.target.value))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: s.color }}
            />
          </div>
        ))}
      </div>
      {TH <= TC && (
        <p className="mt-3 text-xs text-red-500 font-medium">⚠ T_H must be greater than T_C</p>
      )}
    </motion.div>
  )
}

// ─── PV Diagram mini ──────────────────────────────────────────────────────────
interface PVDiagramProps { phase: number; eta: number }

function PVDiagram({ phase, eta }: PVDiagramProps) {
  const W = 200, H = 110
  const pad = 22
  // Approximate PV curve coordinates for Carnot cycle
  const points = [
    { x: 0.15, y: 0.15 }, // state 1 (TDC, high P, low V)
    { x: 0.55, y: 0.35 }, // state 2
    { x: 0.80, y: 0.70 }, // state 3 (BDC, low P, high V)
    { x: 0.40, y: 0.55 }, // state 4
  ]
  const toSVG = (px: number, py: number) => ({
    x: pad + px * (W - pad * 2),
    y: pad + py * (H - pad * 2),
  })
  const paths = [
    // 1→2 isothermal expansion
    `M ${toSVG(points[0].x, points[0].y).x} ${toSVG(points[0].x, points[0].y).y} Q ${toSVG(0.30, 0.18).x} ${toSVG(0.30, 0.18).y} ${toSVG(points[1].x, points[1].y).x} ${toSVG(points[1].x, points[1].y).y}`,
    // 2→3 adiabatic expansion
    `M ${toSVG(points[1].x, points[1].y).x} ${toSVG(points[1].x, points[1].y).y} Q ${toSVG(0.75, 0.45).x} ${toSVG(0.75, 0.45).y} ${toSVG(points[2].x, points[2].y).x} ${toSVG(points[2].x, points[2].y).y}`,
    // 3→4 isothermal compression
    `M ${toSVG(points[2].x, points[2].y).x} ${toSVG(points[2].x, points[2].y).y} Q ${toSVG(0.55, 0.68).x} ${toSVG(0.55, 0.68).y} ${toSVG(points[3].x, points[3].y).x} ${toSVG(points[3].x, points[3].y).y}`,
    // 4→1 adiabatic compression
    `M ${toSVG(points[3].x, points[3].y).x} ${toSVG(points[3].x, points[3].y).y} Q ${toSVG(0.20, 0.42).x} ${toSVG(0.20, 0.42).y} ${toSVG(points[0].x, points[0].y).x} ${toSVG(points[0].x, points[0].y).y}`,
  ]

  const phaseColors = ['#E8593C', '#7C5CBF', '#2E7DD4', '#1B9E6E']

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {/* Axes */}
      <line x1={pad} y1={pad} x2={pad} y2={H - pad + 6} stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" />
      <line x1={pad - 6} y1={H - pad} x2={W - pad} y2={H - pad} stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" />
      <text x={pad - 4} y={pad - 6} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.4">P</text>
      <text x={W - pad + 2} y={H - pad + 2} textAnchor="start" fontSize="9" fill="currentColor" fillOpacity="0.4">V</text>

      {/* Filled loop area */}
      <path
        d={`${paths[0]} ${paths[1]} ${paths[2]} ${paths[3]} Z`}
        fill="currentColor" fillOpacity="0.06"
      />

      {/* All paths */}
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={phaseColors[i]}
          strokeWidth={i === phase ? 2.5 : 1}
          strokeOpacity={i === phase ? 1 : 0.3}
          strokeLinecap="round"
        />
      ))}

      {/* State dots */}
      {points.map((p, i) => {
        const c = toSVG(p.x, p.y)
        return (
          <circle key={i} cx={c.x} cy={c.y} r={i === phase || (i + 3) % 4 === phase ? 4 : 2.5}
            fill={phaseColors[phase]} fillOpacity={i === phase || (i + 3) % 4 === phase ? 1 : 0.4}
          />
        )
      })}

      {/* η label */}
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.5">
        η = {(eta * 100).toFixed(1)}%
      </text>
    </svg>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function EngineModule() {
  const [TH, setTH] = useState(800)
  const [TC, setTC] = useState(300)
  const [n, setN] = useState(1)
  const [V1, setV1] = useState(1)
  const [V2, setV2] = useState(4)

  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [angle, setAngle] = useState(-Math.PI / 2)
  const [phase, setPhase] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [particles, setParticles] = useState<Particle[]>([])
  const [tick, setTick] = useState(0)

  const rafRef = useRef<number>()
  const lastRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Physics
  const eta = carnotEfficiency(TH, TC)
  const QH_val = qH(n, TH, V1, V2)
  const QC_val = qC(n, TC, V1, V2)
  const W_net = QH_val - QC_val
  const COP = TC > 0 ? TC / (TH - TC) : 0

  // Piston geometry
  const pY = pistonY(angle)
  const pistonTop = Math.max(CYL_TOP + 2, Math.min(CYL_BOT - PISTON_H - 2, pY))
  const pistonBot = pistonTop + PISTON_H
  const cpX = CRANK_CX + CRANK_R * Math.cos(angle)
  const cpY = CRANK_CY + CRANK_R * Math.sin(angle)

  // Gas region
  const gasHeight = Math.max(0, CYL_BOT - pistonBot)
  const gasTop = pistonBot
  const gasBottom = CYL_BOT

  // Determine current phase from angle
  const normAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  const computedPhase = normAngle < Math.PI / 2 ? 0
    : normAngle < Math.PI ? 1
    : normAngle < Math.PI * 3 / 2 ? 2 : 3

  // Gas color interpolation
  const gasProgress = (gasTop - CYL_TOP) / (CYL_BOT - CYL_TOP - PISTON_H)
  const gasHot = computedPhase === 0 || computedPhase === 1
  const gasR = Math.round(gasHot ? 220 + gasProgress * 30 : 40 + gasProgress * 20)
  const gasG = Math.round(gasHot ? 90 - gasProgress * 30 : 100 + gasProgress * 50)
  const gasB = Math.round(gasHot ? 60 : 200 + gasProgress * 40)
  const gasColor = `rgba(${gasR},${gasG},${gasB},0.18)`
  const gasMist = `rgba(${gasR},${gasG},${gasB},0.06)`
  const gasT = Math.round(TC + (TH - TC) * (1 - (pistonTop - CYL_TOP) / (CYL_BOT - CYL_TOP - PISTON_H)))

  const fmt = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1e6) return (v / 1e6).toFixed(2) + 'M'
    if (abs >= 1e3) return (v / 1e3).toFixed(2) + 'k'
    return v.toFixed(1)
  }

  // Init particles
  useEffect(() => {
    setParticles(createParticles(28, gasBottom, gasTop, CYL_LEFT + 4, CYL_RIGHT - 4, computedPhase))
  }, [computedPhase])

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastRef.current = null
      return
    }
    const radsPerMs = (speed * 60 * 2 * Math.PI) / 60000

    const animate = (ts: number) => {
      if (lastRef.current != null) {
        const dt = ts - lastRef.current
        setAngle(a => a + radsPerMs * dt)
        setTick(t => t + 1)
      }
      lastRef.current = ts
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastRef.current = null
    }
  }, [isPlaying, speed])

  // Update particles
  useEffect(() => {
    if (!isPlaying || particles.length === 0) return

    setParticles(prev => prev.map(p => {
      let nx = p.x + p.vx * speed
      let ny = p.y + p.vy * speed
      let nvx = p.vx
      let nvy = p.vy

      // Bounce off cylinder walls
      if (nx < CYL_LEFT + 4 || nx > CYL_RIGHT - 4) nvx = -nvx
      if (ny < gasTop + 2) { nvy = Math.abs(nvy); ny = gasTop + 2 }
      if (ny > gasBottom - 2) { nvy = -Math.abs(nvy); ny = gasBottom - 2 }

      nx = Math.max(CYL_LEFT + 4, Math.min(CYL_RIGHT - 4, nx))
      ny = Math.max(gasTop + 2, Math.min(gasBottom - 2, ny))

      // Slight randomness for thermal motion feel
      const thermalJitter = 0.04 * (gasHot ? 1.8 : 0.7)
      nvx += (Math.random() - 0.5) * thermalJitter
      nvy += (Math.random() - 0.5) * thermalJitter

      // Clamp speed
      const maxV = gasHot ? 1.8 : 0.9
      const spd = Math.sqrt(nvx * nvx + nvy * nvy)
      if (spd > maxV) { nvx = (nvx / spd) * maxV; nvy = (nvy / spd) * maxV }

      return { ...p, x: nx, y: ny, vx: nvx, vy: nvy }
    }))
  }, [tick])

  const reset = () => {
    setIsPlaying(false)
    setAngle(-Math.PI / 2)
    setPhase(0)
  }

  const currentPhase = PHASES[computedPhase]
  const thermalContact = currentPhase.thermal

  const WHEEL_CX = 480, WHEEL_CY = 200, WHEEL_R = 44

  return (
    <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#0d1117] transition-colors duration-500 font-sans">
      {/* ── Header ── */}
      <div className="relative flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur-lg border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: currentPhase.colorLight }}>
            <div className="w-3 h-3 rounded-full" style={{ background: currentPhase.color }} />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight tracking-tight">Carnot Engine</h1>
            <p className="text-xs text-gray-400 leading-none mt-0.5">Ideal thermodynamic cycle</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Phase pills */}
          <div className="hidden sm:flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-full p-1">
            {PHASES.map((p, i) => (
              <button
                key={i}
                onClick={() => { setAngle(-Math.PI / 2 + i * Math.PI / 2); setIsPlaying(false) }}
                className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200"
                style={computedPhase === i ? { background: p.color, color: 'white' } : { color: '#888' }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <Settings size={16} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <AnimatePresence>
          {showSettings && (
            <SettingsPanel
              TH={TH} TC={TC} n={n} V1={V1} V2={V2}
              setTH={setTH} setTC={setTC} setN={setN} setV1={setV1} setV2={setV2}
              onClose={() => setShowSettings(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

        {/* ── Engine SVG Card ── */}
        <div className="bg-white dark:bg-[#161b22] rounded-3xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
          {/* Phase banner */}
          <div className="px-5 py-3 flex items-center justify-between" style={{ background: currentPhase.colorLight + (document.documentElement.classList.contains('dark') ? '22' : '') }}>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: currentPhase.color }} />
              <span className="text-sm font-bold tracking-tight" style={{ color: currentPhase.color }}>{currentPhase.name}</span>
            </div>
            <span className="text-xs font-mono text-gray-400">{currentPhase.label}</span>
          </div>

          {/* SVG engine */}
          <div className="p-4">
            <svg viewBox="0 0 560 410" width="100%" style={{ display: 'block' }}>
              <defs>
                <linearGradient id="engHotRes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C1391E" />
                  <stop offset="100%" stopColor="#E8593C" />
                </linearGradient>
                <linearGradient id="engColdRes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1A5FA8" />
                  <stop offset="100%" stopColor="#2E7DD4" />
                </linearGradient>
                <linearGradient id="engCylWall" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#94a3b8" />
                  <stop offset="15%" stopColor="#e2e8f0" />
                  <stop offset="85%" stopColor="#e2e8f0" />
                  <stop offset="100%" stopColor="#94a3b8" />
                </linearGradient>
                <linearGradient id="engGas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`rgba(${gasR},${gasG},${gasB},0.3)`} />
                  <stop offset="100%" stopColor={`rgba(${gasR},${gasG},${gasB},0.1)`} />
                </linearGradient>
                <linearGradient id="engPiston" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e2e8f0" />
                  <stop offset="100%" stopColor="#64748b" />
                </linearGradient>
                <filter id="engBlur" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="6" />
                </filter>
                <filter id="engGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                {/* Insulation hatch */}
                <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8">
                  <line x1="0" y1="8" x2="8" y2="0" stroke="#7C5CBF" strokeWidth="1" strokeOpacity="0.3" />
                </pattern>
              </defs>

              {/* ── HOT RESERVOIR (top) ── */}
              <g>
                <rect x="28" y="6" width="248" height="52" rx="12"
                  fill={thermalContact === 'contact-hot' ? "url(#engHotRes)" : "#e2e8f0"}
                  fillOpacity={thermalContact === 'contact-hot' ? 1 : 0.4}
                />
                {thermalContact === 'contact-hot' && (
                  <rect x="28" y="6" width="248" height="52" rx="12" fill="none" stroke="#E8593C" strokeWidth="1.5" strokeOpacity="0.6" />
                )}
                <text x="152" y="26" textAnchor="middle" fill={thermalContact === 'contact-hot' ? "white" : "#94a3b8"}
                  fontSize="9" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fillOpacity="0.8">
                  HOT RESERVOIR
                </text>
                <text x="152" y="43" textAnchor="middle" fill={thermalContact === 'contact-hot' ? "white" : "#94a3b8"}
                  fontSize="13" fontFamily="monospace" fontWeight="700">
                  T_H = {TH} K
                </text>

                {/* Flame dots when active */}
                {thermalContact === 'contact-hot' && isPlaying && [0, 1, 2, 3, 4].map(i => (
                  <motion.circle
                    key={i} r={2.5} fill="#FCDE5A"
                    cx={60 + i * 46}
                    animate={{ cy: [58 - i % 2 * 3, 52 - i % 2 * 3, 58 - i % 2 * 3], opacity: [0.9, 0.4, 0.9] }}
                    transition={{ duration: 0.5 + i * 0.08, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
              </g>

              {/* ── COLD RESERVOIR (bottom) ── */}
              <g>
                <rect x="28" y="350" width="248" height="52" rx="12"
                  fill={thermalContact === 'contact-cold' ? "url(#engColdRes)" : "#e2e8f0"}
                  fillOpacity={thermalContact === 'contact-cold' ? 1 : 0.4}
                />
                {thermalContact === 'contact-cold' && (
                  <rect x="28" y="350" width="248" height="52" rx="12" fill="none" stroke="#2E7DD4" strokeWidth="1.5" strokeOpacity="0.6" />
                )}
                <text x="152" y="370" textAnchor="middle" fill={thermalContact === 'contact-cold' ? "white" : "#94a3b8"}
                  fontSize="9" fontFamily="monospace" fontWeight="700" letterSpacing="1.5" fillOpacity="0.8">
                  COLD RESERVOIR
                </text>
                <text x="152" y="387" textAnchor="middle" fill={thermalContact === 'contact-cold' ? "white" : "#94a3b8"}
                  fontSize="13" fontFamily="monospace" fontWeight="700">
                  T_C = {TC} K
                </text>

                {/* Snowflake-like dots */}
                {thermalContact === 'contact-cold' && [0, 1, 2, 3, 4].map(i => (
                  <g key={i}>
                    <motion.circle r="3" fill="none" stroke="#93c5fd" strokeWidth="1"
                      cx={60 + i * 46} cy={347}
                      animate={{ r: [2, 4, 2], opacity: [0.7, 0.3, 0.7] }}
                      transition={{ duration: 1.5 + i * 0.2, repeat: Infinity, delay: i * 0.15 }}
                    />
                  </g>
                ))}
              </g>

              {/* ── HEAT FLOW ARROWS ── */}
              {/* Q_H flow (hot → cylinder) */}
              <line x1={CYL_MID} y1={58} x2={CYL_MID} y2={CYL_TOP - 2}
                stroke="#E8593C" strokeWidth="2" strokeDasharray="5,3"
                strokeOpacity={thermalContact === 'contact-hot' ? 0.9 : 0.15}
              />
              {thermalContact === 'contact-hot' && (
                <motion.polygon
                  points={`${CYL_MID - 5},${CYL_TOP - 2} ${CYL_MID + 5},${CYL_TOP - 2} ${CYL_MID},${CYL_TOP + 8}`}
                  fill="#E8593C"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              )}

              {/* Q_C flow (cylinder → cold) */}
              <line x1={CYL_MID} y1={CYL_BOT + 2} x2={CYL_MID} y2={348}
                stroke="#2E7DD4" strokeWidth="2" strokeDasharray="5,3"
                strokeOpacity={thermalContact === 'contact-cold' ? 0.9 : 0.15}
              />
              {thermalContact === 'contact-cold' && (
                <motion.polygon
                  points={`${CYL_MID - 5},${348} ${CYL_MID + 5},${348} ${CYL_MID},${338}`}
                  fill="#2E7DD4"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              )}

              {/* Q_H particles */}
              {thermalContact === 'contact-hot' && isPlaying && [0, 1, 2].map(i => (
                <motion.circle key={i} r={3} fill="#E8593C"
                  animate={{
                    cx: [CYL_MID + (i - 1) * 10, CYL_MID + (i - 1) * 4],
                    cy: [58, CYL_TOP + 10],
                    opacity: [0, 0.9, 0],
                  }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.23 }}
                />
              ))}

              {/* Q_C particles */}
              {thermalContact === 'contact-cold' && isPlaying && [0, 1, 2].map(i => (
                <motion.circle key={i} r={3} fill="#2E7DD4"
                  animate={{
                    cx: [CYL_MID + (i - 1) * 10, CYL_MID + (i - 1) * 4],
                    cy: [CYL_BOT - 8, 350],
                    opacity: [0, 0.9, 0],
                  }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.23 }}
                />
              ))}

              {/* ── INSULATION INDICATOR ── */}
              {thermalContact === 'insulated' && (
                <>
                  <rect x={CYL_LEFT - 20} y={CYL_TOP - 2} width={CYL_WIDTH + 40} height={10} fill="url(#hatch)" />
                  <rect x={CYL_LEFT - 20} y={CYL_BOT - 8} width={CYL_WIDTH + 40} height={10} fill="url(#hatch)" />
                  <text x={CYL_MID + CYL_WIDTH / 2 + 28} y={CYL_TOP + 6} fontSize="8" fill="#7C5CBF" fontFamily="monospace" fontWeight="700">INSULATED</text>
                </>
              )}

              {/* ── CYLINDER WALLS ── */}
              <rect x={CYL_LEFT - 16} y={CYL_TOP - 10} width={CYL_WIDTH + 32} height={CYL_BOT - CYL_TOP + 20} rx="6"
                fill="url(#engCylWall)" />
              {/* Cylinder interior (dark) */}
              <rect x={CYL_LEFT} y={CYL_TOP} width={CYL_WIDTH} height={CYL_BOT - CYL_TOP} fill="#0f172a" />

              {/* ── GAS MIST (blur layer) ── */}
              {gasHeight > 0 && (
                <rect x={CYL_LEFT + 1} y={gasTop} width={CYL_WIDTH - 2} height={gasHeight}
                  fill="url(#engGas)" rx="1" />
              )}

              {/* ── GAS MIST BLUR GLOW ── */}
              {gasHeight > 10 && (
                <rect x={CYL_LEFT + 10} y={gasTop + gasHeight * 0.3} width={CYL_WIDTH - 20} height={gasHeight * 0.4}
                  fill={`rgba(${gasR},${gasG},${gasB},0.08)`} filter="url(#engBlur)" />
              )}

              {/* ── GAS PARTICLES (mist dots) ── */}
              {particles.map(p => (
                <circle
                  key={p.id}
                  cx={p.x} cy={p.y} r={p.r}
                  fill={`hsl(${p.hue}, 70%, 65%)`}
                  fillOpacity={p.opacity}
                />
              ))}

              {/* ── GAS TEMP LABEL ── */}
              {gasHeight > 50 && (
                <text x={CYL_MID} y={(gasTop + gasBottom) / 2 + 5} textAnchor="middle"
                  fill="white" fillOpacity="0.5" fontSize="11" fontFamily="monospace" fontWeight="600">
                  T ≈ {gasT} K
                </text>
              )}

              {/* ── PISTON ── */}
              <rect x={CYL_LEFT + 3} y={pistonTop} width={CYL_WIDTH - 6} height={PISTON_H} rx="3"
                fill="url(#engPiston)" />
              {/* Piston ring grooves */}
              <rect x={CYL_LEFT + 3} y={pistonTop + 5} width={CYL_WIDTH - 6} height="2" fill="#475569" fillOpacity="0.5" />
              <rect x={CYL_LEFT + 3} y={pistonTop + 12} width={CYL_WIDTH - 6} height="2" fill="#475569" fillOpacity="0.5" />
              {/* Piston highlight */}
              <rect x={CYL_LEFT + 8} y={pistonTop + 2} width={(CYL_WIDTH - 16) * 0.6} height="2" rx="1" fill="white" fillOpacity="0.35" />

              {/* ── PISTON ROD ── */}
              <line x1={CYL_MID} y1={CYL_TOP - 10} x2={CYL_MID} y2={pistonTop}
                stroke="#64748b" strokeWidth="10" strokeLinecap="round" />
              <line x1={CYL_MID} y1={CYL_TOP - 10} x2={CYL_MID} y2={pistonTop}
                stroke="#e2e8f0" strokeWidth="3.5" strokeLinecap="round" />

              {/* ── CONNECTING ROD ── */}
              <line x1={CYL_MID} y1={pistonTop + PISTON_H / 2} x2={cpX} y2={cpY}
                stroke="#334155" strokeWidth="7" strokeLinecap="round" />
              <line x1={CYL_MID} y1={pistonTop + PISTON_H / 2} x2={cpX} y2={cpY}
                stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx={cpX} cy={cpY} r="6" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
              <circle cx={CYL_MID} cy={pistonTop + PISTON_H / 2} r="5" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />

              {/* ── CRANKSHAFT ── */}
              <line x1={CRANK_CX} y1={CRANK_CY} x2={cpX} y2={cpY}
                stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
              <line x1={CRANK_CX} y1={CRANK_CY} x2={cpX} y2={cpY}
                stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
              <line x1={CRANK_CX} y1={CRANK_CY} x2={WHEEL_CX} y2={WHEEL_CY}
                stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
              <line x1={CRANK_CX} y1={CRANK_CY} x2={WHEEL_CX} y2={WHEEL_CY}
                stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
              <circle cx={CRANK_CX} cy={CRANK_CY} r="11" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
              <circle cx={CRANK_CX} cy={CRANK_CY} r="4" fill="#64748b" />

              {/* ── FLYWHEEL ── */}
              <circle cx={WHEEL_CX} cy={WHEEL_CY} r={WHEEL_R} fill="none" stroke="#d97706" strokeWidth="6" />
              <circle cx={WHEEL_CX} cy={WHEEL_CY} r={WHEEL_R - 10} fill="none" stroke="#fef08a" strokeWidth="0.5" strokeOpacity="0.2" />
              <circle cx={WHEEL_CX} cy={WHEEL_CY} r="7" fill="#eab308" />
              {[0, 1, 2, 3, 4, 5].map(i => {
                const a = angle + i * Math.PI / 3
                return (
                  <line key={i}
                    x1={WHEEL_CX + 7 * Math.cos(a)} y1={WHEEL_CY + 7 * Math.sin(a)}
                    x2={WHEEL_CX + (WHEEL_R - 3) * Math.cos(a)} y2={WHEEL_CY + (WHEEL_R - 3) * Math.sin(a)}
                    stroke="#eab308" strokeWidth="2.5" strokeLinecap="round"
                  />
                )
              })}

              {/* ── W_NET ARROW ── */}
              <line
                x1={WHEEL_CX + WHEEL_R + 4} y1={WHEEL_CY}
                x2={WHEEL_CX + WHEEL_R + 48} y2={WHEEL_CY}
                stroke="#eab308" strokeWidth="3"
              />
              <polygon
                points={`${WHEEL_CX + WHEEL_R + 48},${WHEEL_CY - 5} ${WHEEL_CX + WHEEL_R + 48},${WHEEL_CY + 5} ${WHEEL_CX + WHEEL_R + 58},${WHEEL_CY}`}
                fill="#eab308"
              />
              <text x={WHEEL_CX + WHEEL_R + 30} y={WHEEL_CY - 10} textAnchor="middle" fill="#d97706" fontSize="9" fontFamily="monospace" fontWeight="700">W_net</text>
              <text x={WHEEL_CX + WHEEL_R + 30} y={WHEEL_CY + 22} textAnchor="middle" fill="#eab308" fontSize="11" fontFamily="monospace" fontWeight="700">{fmt(W_net)} J</text>

              {/* ── BOLT DECORATIONS ── */}
              {[CYL_TOP + 20, CYL_TOP + 60, CYL_BOT - 60, CYL_BOT - 20].map((y, i) => (
                <g key={i}>
                  <circle cx={CYL_LEFT - 8} cy={y} r="3.5" fill="#94a3b8" />
                  <circle cx={CYL_RIGHT + 8} cy={y} r="3.5" fill="#94a3b8" />
                  <circle cx={CYL_LEFT - 8} cy={y} r="1.5" fill="#e2e8f0" />
                  <circle cx={CYL_RIGHT + 8} cy={y} r="1.5" fill="#e2e8f0" />
                </g>
              ))}
            </svg>
          </div>

          {/* ── Controls ── */}
          <div className="px-5 pb-5 flex items-center gap-4">
            <button onClick={reset}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
              <RotateCcw size={14} className="text-gray-500 dark:text-gray-300" />
            </button>

            <button onClick={() => setIsPlaying(!isPlaying)}
              className="h-10 px-6 rounded-xl flex items-center gap-2 font-semibold text-sm text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${currentPhase.color}, ${currentPhase.colorMid})` }}>
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? 'Pause' : 'Run cycle'}
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-gray-400 font-mono">Speed</span>
              <input type="range" min={0.5} max={4} step={0.5} value={speed}
                onChange={e => setSpeed(parseFloat(e.target.value))}
                className="w-20 h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500" />
              <span className="text-xs font-mono font-bold text-blue-500 w-7">{speed}×</span>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-4">

          {/* ── Phase explanation card ── */}
          <div className="bg-white dark:bg-[#161b22] rounded-3xl border border-black/5 dark:border-white/5 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{ background: currentPhase.color }}>
                {computedPhase + 1}
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{currentPhase.name}</span>
            </div>
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400 mb-4">
              {currentPhase.description}
            </p>

            {/* Phase nav */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { const p = (computedPhase + 3) % 4; setAngle(-Math.PI / 2 + p * Math.PI / 2); setIsPlaying(false) }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <div className="flex gap-1.5">
                {PHASES.map((p, i) => (
                  <div key={i} className="w-2 h-2 rounded-full transition-all"
                    style={{ background: i === computedPhase ? currentPhase.color : '#e2e8f0', opacity: i === computedPhase ? 1 : 0.5 }} />
                ))}
              </div>
              <button
                onClick={() => { const p = (computedPhase + 1) % 4; setAngle(-Math.PI / 2 + p * Math.PI / 2); setIsPlaying(false) }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* ── PV Diagram ── */}
          <div className="bg-white dark:bg-[#161b22] rounded-3xl border border-black/5 dark:border-white/5 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">PV Diagram</span>
              <span className="text-xs text-gray-400 font-mono">η = {(eta * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-center text-gray-700 dark:text-gray-300">
              <PVDiagram phase={computedPhase} eta={eta} />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {PHASES.map((p, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="w-2.5 h-0.5 rounded" style={{ background: p.color, opacity: i === computedPhase ? 1 : 0.35 }} />
                  <span className="text-xs text-gray-400" style={{ opacity: i === computedPhase ? 1 : 0.5 }}>{p.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Metrics grid ── */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Efficiency η', value: `${(eta * 100).toFixed(1)}%`, sub: '1 − T_C/T_H', color: '#22c55e', bg: '#f0fdf4' },
              { label: 'Heat in Q_H', value: `${fmt(QH_val)} J`, sub: 'from hot reservoir', color: '#E8593C', bg: '#fff3f0' },
              { label: 'Heat out Q_C', value: `${fmt(QC_val)} J`, sub: 'to cold reservoir', color: '#2E7DD4', bg: '#eff6ff' },
              { label: 'Net work W', value: `${fmt(W_net)} J`, sub: 'Q_H − Q_C', color: '#d97706', bg: '#fffbeb' },
              { label: 'COP (refrig)', value: COP.toFixed(2), sub: 'T_C / ΔT', color: '#7C5CBF', bg: '#f5f3ff' },
              { label: 'Gas temp', value: `${gasT} K`, sub: 'current estimate', color: '#0891b2', bg: '#ecfeff' },
            ].map(item => (
              <div key={item.label}
                className="rounded-2xl p-3 border border-black/5 dark:border-white/5"
                style={{ background: item.bg }}>
                <p className="text-xs text-gray-500 font-medium mb-0.5 truncate">{item.label}</p>
                <p className="text-sm font-bold font-mono" style={{ color: item.color }}>{item.value}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{item.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Efficiency bar ── */}
          <div className="bg-white dark:bg-[#161b22] rounded-3xl border border-black/5 dark:border-white/5 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Efficiency</span>
              <span className="text-xs font-mono font-bold" style={{ color: eta > 0.6 ? '#22c55e' : eta > 0.35 ? '#d97706' : '#ef4444' }}>
                {(eta * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${eta > 0.6 ? '#22c55e' : eta > 0.35 ? '#d97706' : '#ef4444'}, ${eta > 0.6 ? '#4ade80' : eta > 0.35 ? '#fbbf24' : '#f87171'})` }}
                animate={{ width: `${eta * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-gray-400">0%</span>
              <span className="text-xs text-gray-400">Carnot limit</span>
              <span className="text-xs text-gray-400">100%</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              No real engine can exceed the Carnot efficiency. It sets the theoretical maximum for any heat engine operating between these two temperatures.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
