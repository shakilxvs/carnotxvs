import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, SlidersHorizontal, Moon, Sun, ChevronRight } from 'lucide-react'
import BackButton from './BackButton'
import { efficiency, heatAbsorbed, heatRejected, netWork, copR } from '../utils/carnotPhysics'
import { useApp } from '../context/AppContext'

// ── SVG layout constants (compact, no pill panel inside SVG) ─────────────────
const SW = 620, SH = 468
const CYL_X = 100, CYL_W = 170
const CYL_TOP = 108, CYL_BOT = 358
const CYL_MID = CYL_X + CYL_W / 2          // 185
const PISTON_H = 20, PISTON_PAD = 4
const CRANK_CX = 390, CRANK_CY = 233
const CRANK_R = 55, ROD_LEN = 108
const WHEEL_CX = 470, WHEEL_CY = 233, WHEEL_R = 42
const RES_X = 44, RES_W = 282
const HOT_Y = 10, HOT_H = 64
const COLD_Y = 392, COLD_H = 64
// Efficiency gauge (top-right, clear of W_net arrow which ends at ~559)
const G_CX = 590, G_CY = 50, G_R = 26

// ── Phase step definitions ────────────────────────────────────────────────────
const PHASE_STEPS = [
  {
    label: '1→2',
    title: 'Isothermal Expansion',
    color: '#ef4444',
    range: [0, Math.PI / 2] as [number, number],
    formula: 'W = Q_H = nRT_H · ln(V₂/V₁)',
    laws: 'ΔU = 0  •  T = T_H = const',
  },
  {
    label: '2→3',
    title: 'Adiabatic Expansion',
    color: '#a855f7',
    range: [Math.PI / 2, Math.PI] as [number, number],
    formula: 'W = nCᵥ(T_H − T_C)',
    laws: 'Q = 0  •  ΔU = −W',
  },
  {
    label: '3→4',
    title: 'Isothermal Compression',
    color: '#3b82f6',
    range: [Math.PI, Math.PI * 3 / 2] as [number, number],
    formula: 'W = Q_C = nRT_C · ln(V₄/V₃)',
    laws: 'ΔU = 0  •  T = T_C = const',
  },
  {
    label: '4→1',
    title: 'Adiabatic Compression',
    color: '#22c55e',
    range: [Math.PI * 3 / 2, Math.PI * 2] as [number, number],
    formula: 'W = nCᵥ(T_C − T_H)',
    laws: 'Q = 0  •  ΔU = −W',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function pistonY(angle: number) {
  const cpX = CRANK_CX + CRANK_R * Math.cos(angle)
  const cpY = CRANK_CY + CRANK_R * Math.sin(angle)
  const dx = CYL_MID - cpX
  return cpY - Math.sqrt(Math.max(0, ROD_LEN * ROD_LEN - dx * dx))
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

function getNorm(angle: number) {
  return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Flames({ active, speed }: { active: boolean; speed: number }) {
  if (!active) return null
  return <>
    {[0, 1, 2, 3, 4, 5].map(i => {
      const x = RES_X + 24 + i * (RES_W - 48) / 5
      const dur = (0.5 + (i % 3) * 0.14) / speed
      return (
        <motion.ellipse key={i}
          cx={x} cy={HOT_Y + HOT_H - 5}
          rx={3.5 + (i % 3)} ry={5 + (i % 4) * 3}
          fill={i % 2 === 0 ? '#f97316' : '#fbbf24'} fillOpacity={0.85}
          animate={{ cy: [HOT_Y + HOT_H - 5, HOT_Y + HOT_H - 26, HOT_Y + HOT_H - 5], scaleY: [1, 1.6, 1], opacity: [0.9, 0.4, 0.9] }}
          transition={{ duration: dur, repeat: Infinity, delay: i * 0.09, ease: 'easeInOut' }}
        />
      )
    })}
  </>
}

function Snowflakes({ active }: { active: boolean }) {
  if (!active) return null
  return <>
    {[0, 1, 2, 3, 4].map(i => {
      const x = RES_X + 28 + i * (RES_W - 56) / 4
      const cy = COLD_Y + COLD_H / 2
      return (
        <motion.g key={i}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 4 + i * 0.6, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: `${x}px ${cy}px` }}
        >
          {[0, 60, 120].map(a => {
            const r = (a * Math.PI) / 180
            return <line key={a}
              x1={x - 7 * Math.cos(r)} y1={cy - 7 * Math.sin(r)}
              x2={x + 7 * Math.cos(r)} y2={cy + 7 * Math.sin(r)}
              stroke="#93c5fd" strokeWidth="1.5" strokeOpacity="0.7" />
          })}
        </motion.g>
      )
    })}
  </>
}

function QHParticles({ active, speed }: { active: boolean; speed: number }) {
  if (!active) return null
  return <>
    {[0, 1, 2, 3].map(i => (
      <motion.circle key={i} r={4} fill="#f97316" fillOpacity={0.9}
        animate={{
          cx: [CYL_MID + (i % 2 === 0 ? -15 : 15), CYL_MID + (i % 2 === 0 ? -4 : 4)],
          cy: [HOT_Y + HOT_H + 2, CYL_TOP + 12],
          opacity: [0, 1, 1, 0],
          r: [5, 3, 2],
        }}
        transition={{ duration: 0.8 / speed, repeat: Infinity, delay: i * 0.2, ease: 'easeIn' }}
      />
    ))}
  </>
}

function QCParticles({ active, speed }: { active: boolean; speed: number }) {
  if (!active) return null
  return <>
    {[0, 1, 2, 3].map(i => (
      <motion.circle key={i} r={4} fill="#3b82f6" fillOpacity={0.9}
        animate={{
          cx: [CYL_MID + (i % 2 === 0 ? -12 : 12), CYL_MID + (i % 2 === 0 ? -22 : 22)],
          cy: [CYL_BOT - 12, COLD_Y - 2],
          opacity: [0, 1, 1, 0],
          r: [4, 3, 2],
        }}
        transition={{ duration: 0.8 / speed, repeat: Infinity, delay: i * 0.2, ease: 'easeOut' }}
      />
    ))}
  </>
}

function Wheel({ angle }: { angle: number }) {
  return (
    <g>
      <circle cx={WHEEL_CX} cy={WHEEL_CY} r={WHEEL_R} fill="none" stroke="#d97706" strokeWidth="5" />
      <circle cx={WHEEL_CX} cy={WHEEL_CY} r={WHEEL_R - 10} fill="none" stroke="#fef08a" strokeWidth="1" strokeOpacity="0.2" />
      <circle cx={WHEEL_CX} cy={WHEEL_CY} r={7} fill="#eab308" />
      {[0, 1, 2, 3, 4, 5].map(i => {
        const a = angle + i * Math.PI / 3
        return <line key={i}
          x1={WHEEL_CX + 7 * Math.cos(a)} y1={WHEEL_CY + 7 * Math.sin(a)}
          x2={WHEEL_CX + (WHEEL_R - 3) * Math.cos(a)} y2={WHEEL_CY + (WHEEL_R - 3) * Math.sin(a)}
          stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" />
      })}
    </g>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function EngineModule() {
  const { darkMode, setDarkMode } = useApp()
  const [T_H, setTH] = useState(800)
  const [T_C, setTC] = useState(300)
  const [n, setN] = useState(1)
  const [V1, setV1] = useState(1)
  const [V2, setV2] = useState(4)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showSliders, setShowSliders] = useState(false)
  const [angle, setAngle] = useState(-Math.PI / 2)
  const rafRef = useRef<number | null>(null)
  const lastRef = useRef<number | null>(null)

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      lastRef.current = null
      return
    }
    const radsPerMs = (speed * 60 * 2 * Math.PI) / 60000
    const tick = (ts: number) => {
      if (lastRef.current != null) setAngle(a => a + radsPerMs * (ts - lastRef.current!))
      lastRef.current = ts
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      lastRef.current = null
    }
  }, [isPlaying, speed])

  const reset = () => { setIsPlaying(false); setAngle(-Math.PI / 2) }

  // Advance to start of next phase
  const goNextStep = () => {
    setAngle(prev => {
      const norm = getNorm(prev)
      const curIdx = PHASE_STEPS.findIndex(s => norm >= s.range[0] && norm < s.range[1])
      const nextIdx = (curIdx + 1) % 4
      const nextStart = PHASE_STEPS[nextIdx].range[0]
      const base = prev - norm
      return base + nextStart + (nextStart <= norm ? Math.PI * 2 : 0)
    })
  }

  // Physics
  const eta = T_H > T_C ? efficiency(T_H, T_C) : 0
  const Q_H = heatAbsorbed(n, T_H, V1, V2)
  const Q_C = Math.abs(heatRejected(n, T_C, V2 * Math.pow(T_H / T_C, 2.5), V1 * Math.pow(T_H / T_C, 2.5)))
  const W_net = netWork(Q_H, Q_C)
  const COP_R = T_H > T_C ? copR(T_H, T_C) : 0

  const fmt = (v: number) =>
    Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + 'M' :
    Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(2) + 'k' :
    v.toFixed(1)

  // Geometry
  const pY = pistonY(angle)
  const pTop = Math.max(CYL_TOP, Math.min(CYL_BOT - PISTON_H - 2, pY))
  const pBot = pTop + PISTON_H
  const cpX = CRANK_CX + CRANK_R * Math.cos(angle)
  const cpY = CRANK_CY + CRANK_R * Math.sin(angle)

  // Gas color (blue=cold → orange=hot)
  const ratio = Math.max(0, Math.min(1, 1 - (pTop - CYL_TOP) / (CYL_BOT - CYL_TOP - PISTON_H)))
  const gasR = Math.round(lerp(59, 249, ratio))
  const gasG = Math.round(lerp(130, 115, ratio))
  const gasB = Math.round(lerp(246, 22, ratio))
  const gasColor = `rgba(${gasR},${gasG},${gasB},0.38)`
  const gasEdge  = `rgb(${gasR},${gasG},${gasB})`
  const gasT = Math.round(lerp(T_C, T_H, ratio))

  // Phase
  const norm = getNorm(angle)
  const expanding = norm < Math.PI
  const qhActive = isPlaying && expanding
  const qcActive = isPlaying && !expanding
  const activeIdx = PHASE_STEPS.findIndex(s => norm >= s.range[0] && norm < s.range[1])

  // Efficiency gauge
  const arc = eta * Math.PI * 1.5
  const gColor = eta > 0.6 ? '#22c55e' : eta > 0.35 ? '#f59e0b' : '#ef4444'
  const gex = G_CX + G_R * Math.cos(Math.PI + arc)
  const gey = G_CY + G_R * Math.sin(Math.PI + arc)

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
      className="min-h-screen bg-[#fafafa] dark:bg-[#0f172a] transition-colors duration-300"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <BackButton />
        <div className="text-center">
          <h1 className="font-serif text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Carnot Engine</h1>
          <p className="hidden sm:block font-sans text-xs text-gray-400 mt-0.5">Mechanical cross-section · live simulation</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSliders(!showSliders)}
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-xs font-sans transition-colors"
          >
            <SlidersHorizontal size={13} />
            <span className="hidden sm:inline">Params</span>
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-7 h-7 rounded-full bg-white dark:bg-[#1e293b] shadow-sm flex items-center justify-center text-gray-500 dark:text-gray-300 transition-colors"
          >
            {darkMode ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      </div>

      {/* ── Sliders Panel ── */}
      <AnimatePresence>
        {showSliders && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1e293b]"
          >
            <div className="px-3 sm:px-5 py-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {[
                { label: 'T_H (K)', value: T_H, set: setTH, min: 301, max: 1500, step: 10 },
                { label: 'T_C (K)', value: T_C, set: setTC, min: 50,  max: 899,  step: 10 },
                { label: 'n (mol)', value: n,   set: setN,  min: 0.1, max: 5,    step: 0.1 },
                { label: 'V₁ (L)', value: V1,  set: setV1, min: 0.1, max: 5,    step: 0.1 },
                { label: 'V₂ (L)', value: V2,  set: setV2, min: 0.5, max: 20,   step: 0.5 },
              ].map(s => (
                <div key={s.label} className="space-y-1">
                  <div className="flex justify-between">
                    <label className="font-mono text-xs text-gray-500 dark:text-gray-400">{s.label}</label>
                    <span className="font-mono text-xs text-amber-600 dark:text-amber-400">{s.value}</span>
                  </div>
                  <input
                    type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                    onChange={e => s.set(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded accent-amber-500"
                  />
                </div>
              ))}
            </div>
            {T_H <= T_C && (
              <p className="px-3 sm:px-5 pb-2 font-sans text-xs text-red-500">T_H must be greater than T_C</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SVG Engine (compact, pills removed, fits screen) ── */}
      <div className="w-full px-1 sm:px-3 pt-2 pb-1">
        <svg
          viewBox={`0 0 ${SW} ${SH}`}
          width="100%"
          style={{ display: 'block', maxHeight: '50vh' }}
        >
          <defs>
            <linearGradient id="hotG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7f1d1d" /><stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
            <linearGradient id="coldG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e3a8a" /><stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <linearGradient id="wallG" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#475569" />
              <stop offset="18%"  stopColor="#cbd5e1" />
              <stop offset="82%"  stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
            <linearGradient id="pistG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#e2e8f0" />
              <stop offset="60%"  stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
            <linearGradient id="crankG" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#334155" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <marker id="arrowW" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#eab308" />
            </marker>
            <marker id="arrowH" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="#ef4444" />
            </marker>
            <marker id="arrowC" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="#3b82f6" />
            </marker>
          </defs>

          {/* ── HOT RESERVOIR ── */}
          <rect x={RES_X} y={HOT_Y} width={RES_W} height={HOT_H} rx="10" fill="url(#hotG)" />
          <rect x={RES_X} y={HOT_Y} width={RES_W} height={HOT_H} rx="10" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeOpacity="0.5" />
          <text x={RES_X + RES_W / 2} y={HOT_Y + 20} textAnchor="middle" fill="#fca5a5" fontSize="8" fontFamily="monospace" fontWeight="700" letterSpacing="2">HOT RESERVOIR</text>
          <text x={RES_X + RES_W / 2} y={HOT_Y + 40} textAnchor="middle" fill="white"   fontSize="13" fontFamily="monospace" fontWeight="700">T_H = {T_H} K</text>
          <text x={RES_X + RES_W / 2} y={HOT_Y + 57} textAnchor="middle" fill="#fb923c" fontSize="9"  fontFamily="monospace">Q_H = {fmt(Q_H)} J</text>
          <Flames active={isPlaying} speed={speed} />

          {/* ── COLD RESERVOIR ── */}
          <rect x={RES_X} y={COLD_Y} width={RES_W} height={COLD_H} rx="10" fill="url(#coldG)" />
          <rect x={RES_X} y={COLD_Y} width={RES_W} height={COLD_H} rx="10" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.5" />
          <text x={RES_X + RES_W / 2} y={COLD_Y + 20} textAnchor="middle" fill="#93c5fd" fontSize="8"  fontFamily="monospace" fontWeight="700" letterSpacing="2">COLD RESERVOIR</text>
          <text x={RES_X + RES_W / 2} y={COLD_Y + 40} textAnchor="middle" fill="white"   fontSize="13" fontFamily="monospace" fontWeight="700">T_C = {T_C} K</text>
          <text x={RES_X + RES_W / 2} y={COLD_Y + 57} textAnchor="middle" fill="#60a5fa" fontSize="9"  fontFamily="monospace">Q_C = {fmt(Q_C)} J</text>
          <Snowflakes active={isPlaying} />

          {/* ── Q_H flow path ── */}
          <line
            x1={CYL_MID} y1={HOT_Y + HOT_H} x2={CYL_MID} y2={CYL_TOP}
            stroke="#ef4444" strokeWidth="2" strokeDasharray="5,4"
            strokeOpacity={qhActive ? 0.9 : 0.2} markerEnd="url(#arrowH)"
          />
          <QHParticles active={qhActive} speed={speed} />

          {/* ── Q_C flow path ── */}
          <line
            x1={CYL_MID} y1={CYL_BOT} x2={CYL_MID} y2={COLD_Y}
            stroke="#3b82f6" strokeWidth="2" strokeDasharray="5,4"
            strokeOpacity={qcActive ? 0.9 : 0.2} markerEnd="url(#arrowC)"
          />
          <QCParticles active={qcActive} speed={speed} />

          {/* ── CYLINDER WALLS ── */}
          <rect
            x={CYL_X - 16} y={CYL_TOP - 10}
            width={CYL_W + 32} height={CYL_BOT - CYL_TOP + 20}
            rx="6" fill="url(#wallG)"
          />
          <rect x={CYL_X} y={CYL_TOP} width={CYL_W} height={CYL_BOT - CYL_TOP} fill="#0f172a" />

          {/* Gas fill */}
          {pBot < CYL_BOT && (
            <>
              <rect x={CYL_X + 2} y={pBot} width={CYL_W - 4} height={Math.max(0, CYL_BOT - pBot)} fill={gasColor} filter="url(#glow)" />
              <rect x={CYL_X + 2} y={pBot} width={CYL_W - 4} height="4" fill={gasEdge} fillOpacity="0.5" />
            </>
          )}
          {CYL_BOT - pBot > 36 && (
            <text
              x={CYL_MID} y={(pBot + CYL_BOT) / 2 + 5}
              textAnchor="middle" fill="white" fillOpacity="0.6"
              fontSize="10.5" fontFamily="monospace" fontWeight="600"
            >
              T≈{gasT}K
            </text>
          )}

          {/* ── PISTON ROD ── */}
          <line x1={CYL_MID} y1={CYL_TOP - 10} x2={CYL_MID} y2={pTop} stroke="#64748b" strokeWidth="9"  strokeLinecap="round" />
          <line x1={CYL_MID} y1={CYL_TOP - 10} x2={CYL_MID} y2={pTop} stroke="#e2e8f0" strokeWidth="3"  strokeLinecap="round" />

          {/* ── PISTON ── */}
          <rect x={CYL_X + PISTON_PAD} y={pTop} width={CYL_W - PISTON_PAD * 2} height={PISTON_H} rx="3" fill="url(#pistG)" />
          <rect x={CYL_X + PISTON_PAD} y={pTop}              width={CYL_W - PISTON_PAD * 2} height="4"  rx="2" fill="#475569" />
          <rect x={CYL_X + PISTON_PAD} y={pTop + PISTON_H - 4} width={CYL_W - PISTON_PAD * 2} height="4" rx="2" fill="#475569" />

          {/* ── CONNECTING ROD ── */}
          <line x1={CYL_MID} y1={pTop + PISTON_H / 2} x2={cpX} y2={cpY} stroke="#334155" strokeWidth="7"   strokeLinecap="round" />
          <line x1={CYL_MID} y1={pTop + PISTON_H / 2} x2={cpX} y2={cpY} stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={cpX} cy={cpY}                   r="6"   fill="#334155" stroke="#94a3b8" strokeWidth="2" />
          <circle cx={CYL_MID} cy={pTop + PISTON_H / 2} r="4.5" fill="#334155" stroke="#94a3b8" strokeWidth="2" />

          {/* ── CRANKSHAFT ── */}
          <line x1={CRANK_CX} y1={CRANK_CY} x2={cpX}      y2={cpY}      stroke="url(#crankG)" strokeWidth="10" strokeLinecap="round" />
          <line x1={CRANK_CX} y1={CRANK_CY} x2={WHEEL_CX} y2={WHEEL_CY} stroke="#475569"      strokeWidth="10" strokeLinecap="round" />
          <line x1={CRANK_CX} y1={CRANK_CY} x2={WHEEL_CX} y2={WHEEL_CY} stroke="#94a3b8"      strokeWidth="3.5" strokeLinecap="round" />
          <circle cx={CRANK_CX} cy={CRANK_CY} r="11" fill="#0f172a" stroke="#64748b" strokeWidth="2.5" />
          <circle cx={CRANK_CX} cy={CRANK_CY} r="4.5" fill="#94a3b8" />

          {/* ── FLYWHEEL ── */}
          <Wheel angle={angle} />

          {/* ── W_NET OUTPUT ARROW (clear of gauge) ── */}
          <line
            x1={WHEEL_CX + WHEEL_R + 3} y1={WHEEL_CY}
            x2={WHEEL_CX + WHEEL_R + 44} y2={WHEEL_CY}
            stroke="#eab308" strokeWidth="3" markerEnd="url(#arrowW)"
          />
          <text x={WHEEL_CX + WHEEL_R + 24} y={WHEEL_CY - 10} textAnchor="middle" fill="#d97706" fontSize="8.5" fontFamily="monospace" fontWeight="700">W_net</text>
          <text x={WHEEL_CX + WHEEL_R + 24} y={WHEEL_CY + 18} textAnchor="middle" fill="#eab308" fontSize="11"  fontFamily="monospace" fontWeight="700">{fmt(W_net)} J</text>

          {/* ── CYLINDER BOLTS ── */}
          {[CYL_TOP + 18, CYL_TOP + 52, CYL_BOT - 52, CYL_BOT - 18].map((y, i) => (
            <g key={i}>
              <circle cx={CYL_X - 8}          cy={y} r="3.5" fill="#94a3b8" />
              <circle cx={CYL_X + CYL_W + 8}  cy={y} r="3.5" fill="#94a3b8" />
              <circle cx={CYL_X - 8}          cy={y} r="1.5" fill="#e2e8f0" />
              <circle cx={CYL_X + CYL_W + 8}  cy={y} r="1.5" fill="#e2e8f0" />
            </g>
          ))}

          {/* ── EFFICIENCY GAUGE (top-right, no overlap) ── */}
          <path
            d={`M ${G_CX - G_R} ${G_CY} A ${G_R} ${G_R} 0 1 1 ${G_CX + G_R} ${G_CY}`}
            fill="none" stroke="#1e293b" strokeWidth="5" strokeLinecap="round"
          />
          {arc > 0 && (
            <path
              d={`M ${G_CX - G_R} ${G_CY} A ${G_R} ${G_R} 0 ${arc > Math.PI ? 1 : 0} 1 ${gex} ${gey}`}
              fill="none" stroke={gColor} strokeWidth="5" strokeLinecap="round"
            />
          )}
          <text x={G_CX} y={G_CY - 2}  textAnchor="middle" fill={gColor}   fontSize="12" fontFamily="monospace" fontWeight="800">{(eta * 100).toFixed(1)}%</text>
          <text x={G_CX} y={G_CY + 13} textAnchor="middle" fill="#64748b" fontSize="7.5" fontFamily="monospace">η efficiency</text>
        </svg>
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 py-3 flex-wrap">
        {/* Reset */}
        <button
          onClick={reset}
          className="w-8 h-8 rounded-full bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          title="Reset"
        >
          <RotateCcw size={14} />
        </button>

        {/* Play / Pause */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg,#3b82f6,#4f46e5)' }}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>

        {/* Next Step */}
        <button
          onClick={goNextStep}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-xs font-sans font-medium transition-colors"
          title="Jump to next phase"
        >
          Next <ChevronRight size={13} />
        </button>

        {/* Speed */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-gray-400">Speed</span>
          <input
            type="range" min={0.5} max={4} step={0.5} value={speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
            className="w-20 h-1.5 accent-blue-500"
          />
          <span className="font-mono text-xs text-blue-500 w-6">{speed}×</span>
        </div>
      </div>

      {/* ── Phase Steps with Formulas (HTML, no SVG overlap) ── */}
      <div className="px-3 sm:px-4 pb-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {PHASE_STEPS.map((step, i) => {
            const isActive = i === activeIdx
            return (
              <motion.div
                key={i}
                animate={{ scale: isActive ? 1.02 : 1 }}
                transition={{ duration: 0.18 }}
                className="rounded-xl border p-2.5 sm:p-3 transition-colors"
                style={{
                  borderColor: isActive ? step.color : undefined,
                  backgroundColor: isActive ? `${step.color}10` : undefined,
                }}
              >
                {/* Step header */}
                <div className="flex items-center gap-1.5 mb-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0 transition-colors"
                    style={{ backgroundColor: isActive ? step.color : '#64748b' }}
                  />
                  <span
                    className="font-mono text-xs font-bold transition-colors"
                    style={{ color: isActive ? step.color : '#64748b' }}
                  >
                    {step.label}
                  </span>
                  {isActive && (
                    <span
                      className="ml-auto text-xs px-1.5 py-0.5 rounded font-mono font-semibold"
                      style={{ backgroundColor: `${step.color}20`, color: step.color }}
                    >
                      active
                    </span>
                  )}
                </div>

                {/* Title */}
                <p className="font-sans text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2 leading-tight">
                  {step.title}
                </p>

                {/* Formula box */}
                <div className="bg-gray-50 dark:bg-[#0f172a] rounded-lg px-2 py-1.5 mb-2">
                  <p className="font-mono text-xs text-gray-600 dark:text-gray-300 leading-snug break-words">
                    {step.formula}
                  </p>
                </div>

                {/* Thermodynamic laws */}
                <p className="font-mono text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                  {step.laws}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* ── Value Strip ── */}
      <div className="px-3 sm:px-4 pb-6">
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {[
            { label: 'η',     value: `${(eta * 100).toFixed(1)}%`, color: '#22c55e' },
            { label: 'Q_H',  value: `${fmt(Q_H)} J`,              color: '#ef4444' },
            { label: 'Q_C',  value: `${fmt(Q_C)} J`,              color: '#3b82f6' },
            { label: 'W_net',value: `${fmt(W_net)} J`,            color: '#eab308' },
            { label: 'COP_R',value: COP_R.toFixed(3),             color: '#a855f7' },
          ].map(item => (
            <div
              key={item.label}
              className="bg-white dark:bg-[#1e293b] rounded-xl border border-gray-100 dark:border-gray-800 p-1.5 sm:p-2 text-center shadow-sm"
            >
              <p className="font-mono text-xs text-gray-400 mb-0.5">{item.label}</p>
              <p className="font-mono text-xs sm:text-sm font-semibold truncate" style={{ color: item.color }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
