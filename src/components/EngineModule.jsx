import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, SlidersHorizontal, Moon, Sun, ChevronRight } from 'lucide-react'
import BackButton from './BackButton'
import { efficiency, heatAbsorbed, heatRejected, netWork, copR } from '../utils/carnotPhysics'
import { useApp } from '../context/AppContext'

// ── SVG layout constants ──────────────────────────────────────────────────────
const SW = 560, SH = 320
const CYL_X = 80,  CYL_W = 160
const CYL_TOP = 20, CYL_BOT = 280
const CYL_MID = CYL_X + CYL_W / 2   // 160
const PISTON_H = 18, PISTON_PAD = 3
const CRANK_CX = 360, CRANK_CY = 155
const CRANK_R = 52, ROD_LEN = 104
const WHEEL_CX = 445, WHEEL_CY = 155, WHEEL_R = 40
const TWO_PI = Math.PI * 2

// ── Carnot phase definitions ──────────────────────────────────────────────────
// Crank starts at PHASE_START = -π/2 → piston at TDC (top dead centre)
// Each stroke = π/2 of crank rotation
// Normalised angle [0, 2π):
//   Phase 0 – Isothermal Expansion   (hot):   norm ∈ [3π/2, 2π)  piston goes DOWN from TDC
//   Phase 1 – Adiabatic Expansion:            norm ∈ [0,    π/2)
//   Phase 2 – Isothermal Compression (cold):  norm ∈ [π/2,  π)   piston goes UP from BDC
//   Phase 3 – Adiabatic Compression:          norm ∈ [π,    3π/2)

const PHASE_START = -Math.PI / 2   // TDC

const PHASE_STEPS = [
  {
    label: '1→2',
    title: 'Isothermal Expansion',
    color: '#f43f5e',
    // wrap-around range: 270° → 360°
    rangeStart: Math.PI * 3 / 2,
    rangeEnd:   Math.PI * 2,
    wrap: true,
    formula: 'W = Q_H = nRT_H · ln(V₂/V₁)',
    laws: 'ΔU = 0  ·  T = T_H = const',
    heat: 'absorb',
  },
  {
    label: '2→3',
    title: 'Adiabatic Expansion',
    color: '#a855f7',
    rangeStart: 0,
    rangeEnd:   Math.PI / 2,
    wrap: false,
    formula: 'W = nCᵥ(T_H − T_C)',
    laws: 'Q = 0  ·  ΔU = −W',
    heat: 'none',
  },
  {
    label: '3→4',
    title: 'Isothermal Compression',
    color: '#3b82f6',
    rangeStart: Math.PI / 2,
    rangeEnd:   Math.PI,
    wrap: false,
    formula: 'W = Q_C = nRT_C · ln(V₄/V₃)',
    laws: 'ΔU = 0  ·  T = T_C = const',
    heat: 'reject',
  },
  {
    label: '4→1',
    title: 'Adiabatic Compression',
    color: '#22c55e',
    rangeStart: Math.PI,
    rangeEnd:   Math.PI * 3 / 2,
    wrap: false,
    formula: 'W = nCᵥ(T_C − T_H)',
    laws: 'Q = 0  ·  ΔU = −W',
    heat: 'none',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function pistonY(angle) {
  const cpX = CRANK_CX + CRANK_R * Math.cos(angle)
  const cpY = CRANK_CY + CRANK_R * Math.sin(angle)
  const dx = CYL_MID - cpX
  return cpY - Math.sqrt(Math.max(0, ROD_LEN * ROD_LEN - dx * dx))
}

function lerp(a, b, t) { return a + (b - a) * t }

function getNorm(angle) {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI
}

function getPhaseIdx(angle) {
  const norm = getNorm(angle)
  for (let i = 0; i < PHASE_STEPS.length; i++) {
    const { rangeStart, rangeEnd, wrap } = PHASE_STEPS[i]
    if (wrap) {
      if (norm >= rangeStart || norm < rangeEnd) return i
    } else {
      if (norm >= rangeStart && norm < rangeEnd) return i
    }
  }
  return 0
}

function fmt(v) {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(2) + 'k'
  return v.toFixed(1)
}

// ── Particles ─────────────────────────────────────────────────────────────────
function QHParticles({ active, speed }) {
  if (!active) return null
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <motion.circle key={i} r={3} fill="#fb923c" fillOpacity={0.95}
          animate={{
            cx: [CYL_MID + (i % 2 === 0 ? -11 : 11), CYL_MID + (i % 2 === 0 ? -3 : 3)],
            cy: [CYL_TOP - 14, CYL_TOP + 6],
            opacity: [0, 1, 0.8, 0],
          }}
          transition={{ duration: 0.7 / speed, repeat: Infinity, delay: i * 0.17, ease: 'easeIn' }}
        />
      ))}
    </>
  )
}

function QCParticles({ active, speed }) {
  if (!active) return null
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <motion.circle key={i} r={3} fill="#60a5fa" fillOpacity={0.95}
          animate={{
            cx: [CYL_MID + (i % 2 === 0 ? -10 : 10), CYL_MID + (i % 2 === 0 ? -17 : 17)],
            cy: [CYL_BOT - 8, CYL_BOT + 16],
            opacity: [0, 1, 0.8, 0],
          }}
          transition={{ duration: 0.7 / speed, repeat: Infinity, delay: i * 0.17, ease: 'easeOut' }}
        />
      ))}
    </>
  )
}

function Wheel({ angle }) {
  return (
    <g>
      <circle cx={WHEEL_CX} cy={WHEEL_CY} r={WHEEL_R} fill="none" stroke="#d97706" strokeWidth="5" />
      <circle cx={WHEEL_CX} cy={WHEEL_CY} r={WHEEL_R - 9} fill="none" stroke="#fef08a" strokeWidth="1" strokeOpacity="0.15" />
      <circle cx={WHEEL_CX} cy={WHEEL_CY} r={6} fill="#eab308" />
      {[0, 1, 2, 3, 4, 5].map(i => {
        const a = angle + i * Math.PI / 3
        return (
          <line key={i}
            x1={WHEEL_CX + 6 * Math.cos(a)} y1={WHEEL_CY + 6 * Math.sin(a)}
            x2={WHEEL_CX + (WHEEL_R - 3) * Math.cos(a)} y2={WHEEL_CY + (WHEEL_R - 3) * Math.sin(a)}
            stroke="#eab308" strokeWidth="2.5" strokeLinecap="round"
          />
        )
      })}
    </g>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function EngineModule() {
  const { darkMode, setDarkMode } = useApp()
  const [T_H, setTH] = useState(800)
  const [T_C, setTC] = useState(300)
  const [n, setN]   = useState(1)
  const [V1, setV1] = useState(1)
  const [V2, setV2] = useState(4)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showSliders, setShowSliders] = useState(false)
  const [angle, setAngle] = useState(PHASE_START)
  const angleRef = useRef(PHASE_START)
  const rafRef   = useRef(null)
  const lastRef  = useRef(null)

  // Keep ref in sync (avoids stale closure in goNextStep)
  useEffect(() => { angleRef.current = angle }, [angle])

  // Animation loop — one full cycle = 1 second at speed=1
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      lastRef.current = null
      return
    }
    const radsPerMs = (speed * TWO_PI) / 1000
    const tick = (ts) => {
      if (lastRef.current != null) {
        const delta = radsPerMs * (ts - lastRef.current)
        setAngle(a => { const n = a + delta; angleRef.current = n; return n })
      }
      lastRef.current = ts
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      lastRef.current = null
    }
  }, [isPlaying, speed])

  const reset = () => {
    setIsPlaying(false)
    setAngle(PHASE_START)
    angleRef.current = PHASE_START
  }

  // Jump to start of NEXT phase — always move forward, smooth & reliable
  const goNextStep = () => {
    const cur  = angleRef.current
    const norm = getNorm(cur)
    const curIdx  = getPhaseIdx(cur)
    const nextIdx = (curIdx + 1) % 4
    const targetNorm = PHASE_STEPS[nextIdx].rangeStart

    // Distance to travel forward to reach targetNorm
    let forward = targetNorm - norm
    if (forward <= 0) forward += TWO_PI

    const next = cur + forward
    setAngle(next)
    angleRef.current = next
  }

  // ── Physics (correct Carnot) ──
  const valid = T_H > T_C
  const eta   = valid ? efficiency(T_H, T_C) : 0
  const Q_H   = valid ? heatAbsorbed(n, T_H, V1, V2) : 0
  const Q_C   = valid ? Math.abs(heatRejected(n, T_C,
                  V2 * Math.pow(T_H / T_C, 2.5),
                  V1 * Math.pow(T_H / T_C, 2.5))) : 0
  const W_net = valid ? netWork(Q_H, Q_C) : 0
  const COP_R = valid ? copR(T_H, T_C) : 0

  // ── Geometry ──
  const pY   = pistonY(angle)
  const pTop = Math.max(CYL_TOP, Math.min(CYL_BOT - PISTON_H - 2, pY))
  const pBot = pTop + PISTON_H
  const cpX  = CRANK_CX + CRANK_R * Math.cos(angle)
  const cpY  = CRANK_CY + CRANK_R * Math.sin(angle)

  // Gas colour (cold=blue, hot=orange)
  const gasRatio = Math.max(0, Math.min(1, 1 - (pTop - CYL_TOP) / (CYL_BOT - CYL_TOP - PISTON_H)))
  const gR = Math.round(lerp(59, 249, gasRatio))
  const gG = Math.round(lerp(130, 115, gasRatio))
  const gB = Math.round(lerp(246, 22, gasRatio))
  const gasColor = `rgba(${gR},${gG},${gB},0.32)`
  const gasEdge  = `rgb(${gR},${gG},${gB})`
  const gasT     = Math.round(lerp(T_C, T_H, gasRatio))

  const activeIdx = getPhaseIdx(angle)
  const phase     = PHASE_STEPS[activeIdx]
  const qhActive  = isPlaying && activeIdx === 0
  const qcActive  = isPlaying && activeIdx === 2
  const rodPinY   = pTop + PISTON_H / 2

  const etaColor = eta > 0.6 ? '#22c55e' : eta > 0.35 ? '#f59e0b' : '#f43f5e'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-[#f8fafc] dark:bg-[#080e1a] transition-colors duration-300"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-white/5 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-lg sticky top-0 z-20">
        <BackButton />
        <div className="text-center">
          <h1 className="font-serif text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">Carnot Engine</h1>
          <p className="hidden sm:block text-xs text-gray-400 font-sans mt-0.5">Ideal reversible thermodynamic cycle</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSliders(!showSliders)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/8 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 text-xs font-medium transition-all"
          >
            <SlidersHorizontal size={12} />
            <span className="hidden sm:inline">Params</span>
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/8 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
          >
            {darkMode ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      </div>

      {/* ── Params Panel ── */}
      <AnimatePresence>
        {showSliders && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#0f172a]"
          >
            <div className="px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {[
                { label: 'T_H (K)', value: T_H, set: setTH, min: 301, max: 1500, step: 10,  color: '#f43f5e' },
                { label: 'T_C (K)', value: T_C, set: setTC, min: 50,  max: 899,  step: 10,  color: '#3b82f6' },
                { label: 'n (mol)', value: n,   set: setN,  min: 0.1, max: 5,    step: 0.1, color: '#a855f7' },
                { label: 'V₁ (L)', value: V1,  set: setV1, min: 0.1, max: 5,    step: 0.1, color: '#22c55e' },
                { label: 'V₂ (L)', value: V2,  set: setV2, min: 0.5, max: 20,   step: 0.5, color: '#f59e0b' },
              ].map(s => (
                <div key={s.label}>
                  <div className="flex justify-between mb-1.5">
                    <label className="font-mono text-xs text-gray-500 dark:text-gray-400">{s.label}</label>
                    <span className="font-mono text-xs font-bold" style={{ color: s.color }}>{s.value}</span>
                  </div>
                  <input
                    type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                    onChange={e => s.set(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full cursor-pointer"
                    style={{ accentColor: s.color }}
                  />
                </div>
              ))}
            </div>
            {!valid && (
              <p className="px-4 sm:px-6 pb-3 text-xs text-red-400 font-medium">
                ⚠️ T_H must be greater than T_C for a valid Carnot cycle
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-3 sm:px-5 pt-3 space-y-2.5">

        {/* ── Hot Reservoir ── */}
        <motion.div
          animate={{ boxShadow: qhActive ? '0 0 28px rgba(244,63,94,0.3)' : '0 2px 8px rgba(0,0,0,0.06)' }}
          className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#7f1d1d 0%,#9f1239 40%,#f43f5e 100%)' }}
        >
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-xl flex-shrink-0">
                🔥
              </div>
              <div>
                <p className="text-red-300 text-xs font-bold tracking-widest uppercase mb-0.5">Hot Reservoir</p>
                <p className="text-white text-lg sm:text-xl font-bold font-mono leading-none">T_H = {T_H} K</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-red-300 text-xs font-mono mb-0.5">Q_H absorbed</p>
              <p className="text-white text-base font-bold font-mono">{fmt(Q_H)} J</p>
              <AnimatePresence>
                {qhActive && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center justify-end gap-1 mt-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-300 animate-pulse" />
                    <span className="text-orange-200 text-xs font-medium">Flowing ↓</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          {/* bottom progress bar */}
          <motion.div
            className="h-0.5 bg-orange-400/50"
            animate={{ scaleX: qhActive ? 1 : 0, originX: 0 }}
            transition={{ duration: 0.35 }}
          />
        </motion.div>

        {/* ── SVG Engine ── */}
        <div
          className="rounded-2xl overflow-hidden border"
          style={{
            backgroundColor: darkMode ? '#0f172a' : '#ffffff',
            borderColor: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
            boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
          }}
        >
          <svg viewBox={`0 0 ${SW} ${SH}`} width="100%" style={{ display: 'block', maxHeight: '40vh' }}>
            <defs>
              <linearGradient id="wallG" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#334155" />
                <stop offset="14%"  stopColor="#94a3b8" />
                <stop offset="86%"  stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#334155" />
              </linearGradient>
              <linearGradient id="pistG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#e2e8f0" />
                <stop offset="55%"  stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
              <linearGradient id="crankG" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>
              <filter id="gasGlow">
                <feGaussianBlur stdDeviation="2" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <marker id="arrowW" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="#eab308" />
              </marker>
            </defs>

            {/* Q_H arrow (down into top of cylinder) */}
            <line
              x1={CYL_MID} y1={2} x2={CYL_MID} y2={CYL_TOP - 1}
              stroke="#f43f5e" strokeWidth="1.8" strokeDasharray="4,3"
              strokeOpacity={qhActive ? 0.95 : 0.18}
            />
            <polygon
              points={`${CYL_MID - 5},${CYL_TOP - 1} ${CYL_MID + 5},${CYL_TOP - 1} ${CYL_MID},${CYL_TOP + 7}`}
              fill="#f43f5e" fillOpacity={qhActive ? 0.95 : 0.18}
            />
            <QHParticles active={qhActive} speed={speed} />

            {/* Q_C arrow (down out of bottom of cylinder) */}
            <line
              x1={CYL_MID} y1={CYL_BOT + 1} x2={CYL_MID} y2={SH - 4}
              stroke="#3b82f6" strokeWidth="1.8" strokeDasharray="4,3"
              strokeOpacity={qcActive ? 0.95 : 0.18}
            />
            <polygon
              points={`${CYL_MID - 5},${SH - 10} ${CYL_MID + 5},${SH - 10} ${CYL_MID},${SH - 2}`}
              fill="#3b82f6" fillOpacity={qcActive ? 0.95 : 0.18}
            />
            <QCParticles active={qcActive} speed={speed} />

            {/* Cylinder walls */}
            <rect
              x={CYL_X - 13} y={CYL_TOP - 5}
              width={CYL_W + 26} height={CYL_BOT - CYL_TOP + 10}
              rx="5" fill="url(#wallG)"
            />
            <rect x={CYL_X} y={CYL_TOP} width={CYL_W} height={CYL_BOT - CYL_TOP} fill="#0f172a" />

            {/* Gas fill */}
            {pBot < CYL_BOT && (
              <>
                <rect
                  x={CYL_X + 2} y={pBot}
                  width={CYL_W - 4} height={Math.max(0, CYL_BOT - pBot)}
                  fill={gasColor} filter="url(#gasGlow)"
                />
                <rect x={CYL_X + 2} y={pBot} width={CYL_W - 4} height="3" fill={gasEdge} fillOpacity="0.4" />
              </>
            )}
            {CYL_BOT - pBot > 38 && (
              <text
                x={CYL_MID} y={(pBot + CYL_BOT) / 2 + 5}
                textAnchor="middle" fill="white" fillOpacity="0.5"
                fontSize="9.5" fontFamily="monospace" fontWeight="600"
              >T≈{gasT}K</text>
            )}

            {/* Bolts */}
            {[CYL_TOP + 14, CYL_TOP + 38, CYL_BOT - 38, CYL_BOT - 14].map((y, i) => (
              <g key={i}>
                <circle cx={CYL_X - 6}         cy={y} r="3"   fill="#94a3b8" />
                <circle cx={CYL_X + CYL_W + 6} cy={y} r="3"   fill="#94a3b8" />
                <circle cx={CYL_X - 6}         cy={y} r="1.2" fill="#e2e8f0" />
                <circle cx={CYL_X + CYL_W + 6} cy={y} r="1.2" fill="#e2e8f0" />
              </g>
            ))}

            {/* Piston rod */}
            <line x1={CYL_MID} y1={CYL_TOP} x2={CYL_MID} y2={pTop} stroke="#475569" strokeWidth="8" strokeLinecap="round" />
            <line x1={CYL_MID} y1={CYL_TOP} x2={CYL_MID} y2={pTop} stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />

            {/* Piston */}
            <rect x={CYL_X + PISTON_PAD} y={pTop} width={CYL_W - PISTON_PAD * 2} height={PISTON_H} rx="3" fill="url(#pistG)" />
            <rect x={CYL_X + PISTON_PAD} y={pTop}                   width={CYL_W - PISTON_PAD * 2} height="3.5" rx="2" fill="#475569" />
            <rect x={CYL_X + PISTON_PAD} y={pTop + PISTON_H - 3.5} width={CYL_W - PISTON_PAD * 2} height="3.5" rx="2" fill="#475569" />

            {/* Connecting rod */}
            <line x1={CYL_MID} y1={rodPinY} x2={cpX} y2={cpY} stroke="#1e293b" strokeWidth="7" strokeLinecap="round" />
            <line x1={CYL_MID} y1={rodPinY} x2={cpX} y2={cpY} stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={cpX}     cy={cpY}     r="5.5" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
            <circle cx={CYL_MID} cy={rodPinY} r="4"   fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />

            {/* Crankshaft */}
            <line x1={CRANK_CX} y1={CRANK_CY} x2={cpX}      y2={cpY}      stroke="url(#crankG)" strokeWidth="9" strokeLinecap="round" />
            <line x1={CRANK_CX} y1={CRANK_CY} x2={WHEEL_CX} y2={WHEEL_CY} stroke="#334155"      strokeWidth="9" strokeLinecap="round" />
            <line x1={CRANK_CX} y1={CRANK_CY} x2={WHEEL_CX} y2={WHEEL_CY} stroke="#64748b"      strokeWidth="3" strokeLinecap="round" />
            <circle cx={CRANK_CX} cy={CRANK_CY} r="10" fill="#0f172a" stroke="#64748b" strokeWidth="2.5" />
            <circle cx={CRANK_CX} cy={CRANK_CY} r="4"  fill="#94a3b8" />

            {/* Flywheel */}
            <Wheel angle={angle} />

            {/* W_net arrow */}
            <line
              x1={WHEEL_CX + WHEEL_R + 4} y1={WHEEL_CY}
              x2={WHEEL_CX + WHEEL_R + 38} y2={WHEEL_CY}
              stroke="#eab308" strokeWidth="2.5" markerEnd="url(#arrowW)"
            />
            <text x={WHEEL_CX + WHEEL_R + 21} y={WHEEL_CY - 8}  textAnchor="middle" fill="#d97706" fontSize="7.5" fontFamily="monospace" fontWeight="700">W_net</text>
            <text x={WHEEL_CX + WHEEL_R + 21} y={WHEEL_CY + 15} textAnchor="middle" fill="#eab308" fontSize="10"  fontFamily="monospace" fontWeight="700">{fmt(W_net)} J</text>

            {/* Active phase chip */}
            <rect x="7" y="5" width="106" height="20" rx="6" fill={phase.color} fillOpacity="0.18" />
            <text x="14" y="19" fill={phase.color} fontSize="8.5" fontFamily="monospace" fontWeight="700">
              {phase.label} · {phase.title}
            </text>
          </svg>
        </div>

        {/* ── Cold Reservoir ── */}
        <motion.div
          animate={{ boxShadow: qcActive ? '0 0 28px rgba(59,130,246,0.3)' : '0 2px 8px rgba(0,0,0,0.06)' }}
          className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 40%,#3b82f6 100%)' }}
        >
          <motion.div
            className="h-0.5 bg-blue-400/50"
            animate={{ scaleX: qcActive ? 1 : 0, originX: 0 }}
            transition={{ duration: 0.35 }}
          />
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-xl flex-shrink-0">
                ❄️
              </div>
              <div>
                <p className="text-blue-300 text-xs font-bold tracking-widest uppercase mb-0.5">Cold Reservoir</p>
                <p className="text-white text-lg sm:text-xl font-bold font-mono leading-none">T_C = {T_C} K</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-blue-300 text-xs font-mono mb-0.5">Q_C rejected</p>
              <p className="text-white text-base font-bold font-mono">{fmt(Q_C)} J</p>
              <AnimatePresence>
                {qcActive && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center justify-end gap-1 mt-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />
                    <span className="text-blue-200 text-xs font-medium">Flowing ↓</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* ── Controls ── */}
        <div className="flex items-center justify-center gap-2.5 flex-wrap py-1">
          <button
            onClick={reset}
            className="w-9 h-9 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10 transition-all shadow-sm"
          >
            <RotateCcw size={14} />
          </button>

          <motion.button
            onClick={() => setIsPlaying(!isPlaying)}
            whileTap={{ scale: 0.92 }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md transition-all"
            style={{
              background: isPlaying
                ? 'linear-gradient(135deg,#f43f5e,#e11d48)'
                : 'linear-gradient(135deg,#6366f1,#4f46e5)',
            }}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </motion.button>

          <motion.button
            onClick={goNextStep}
            whileTap={{ scale: 0.94 }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/8 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 text-xs font-semibold shadow-sm transition-all"
          >
            Next phase <ChevronRight size={13} />
          </motion.button>

          <div className="flex items-center gap-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/8 rounded-xl px-3 py-2 shadow-sm">
            <span className="text-xs text-gray-400 font-mono">Speed</span>
            <input
              type="range" min={0.25} max={4} step={0.25} value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
              className="w-18 h-1.5 rounded-full cursor-pointer"
              style={{ accentColor: '#6366f1', width: '72px' }}
            />
            <span className="text-xs font-bold font-mono text-indigo-500 w-7">{speed}×</span>
          </div>
        </div>

        {/* ── Phase Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {PHASE_STEPS.map((step, i) => {
            const isActive = i === activeIdx
            return (
              <motion.div
                key={i}
                animate={{ scale: isActive ? 1.025 : 1, y: isActive ? -1 : 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="rounded-2xl border p-3 relative overflow-hidden"
                style={{
                  borderColor: isActive ? step.color : darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                  backgroundColor: isActive
                    ? `${step.color}0e`
                    : darkMode ? 'rgba(255,255,255,0.03)' : '#ffffff',
                  boxShadow: isActive ? `0 4px 18px ${step.color}22` : '0 1px 4px rgba(0,0,0,0.05)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg"
                    style={{
                      color: isActive ? step.color : '#94a3b8',
                      backgroundColor: isActive ? `${step.color}18` : 'transparent',
                    }}
                  >
                    {step.label}
                  </span>
                  {isActive && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: step.color }} />
                      <span className="text-xs font-semibold" style={{ color: step.color }}>live</span>
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-tight mb-2">
                  {step.title}
                </p>
                <div
                  className="rounded-xl px-2.5 py-1.5 mb-2"
                  style={{
                    backgroundColor: isActive ? `${step.color}10` : darkMode ? 'rgba(0,0,0,0.25)' : '#f8fafc',
                  }}
                >
                  <p className="font-mono text-xs text-gray-600 dark:text-gray-300 leading-snug break-words">
                    {step.formula}
                  </p>
                </div>
                <p className="font-mono text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                  {step.laws}
                </p>
              </motion.div>
            )
          })}
        </div>

        {/* ── Value Strip ── */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {[
            { label: 'η',      value: `${(eta * 100).toFixed(1)}%`, color: '#22c55e' },
            { label: 'Q_H',   value: `${fmt(Q_H)} J`,              color: '#f43f5e' },
            { label: 'Q_C',   value: `${fmt(Q_C)} J`,              color: '#3b82f6' },
            { label: 'W_net', value: `${fmt(W_net)} J`,            color: '#eab308' },
            { label: 'COP_R', value: COP_R.toFixed(2),             color: '#a855f7' },
          ].map(item => (
            <div
              key={item.label}
              className="rounded-2xl p-2 sm:p-2.5 text-center border"
              style={{
                backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : '#ffffff',
                borderColor: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}
            >
              <p className="font-mono text-xs text-gray-400 mb-1">{item.label}</p>
              <p className="font-mono text-xs sm:text-sm font-bold truncate" style={{ color: item.color }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Efficiency bar ── */}
        <div
          className="rounded-2xl p-3.5 border"
          style={{
            backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : '#ffffff',
            borderColor: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}
        >
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              η = 1 − T_C / T_H  (Carnot efficiency)
            </span>
            <span className="text-xs font-bold font-mono" style={{ color: etaColor }}>
              {(eta * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-white/8 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${eta * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                background: eta > 0.6
                  ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                  : eta > 0.35
                  ? 'linear-gradient(90deg,#f59e0b,#d97706)'
                  : 'linear-gradient(90deg,#f43f5e,#e11d48)',
              }}
            />
          </div>
        </div>

        <div className="h-4" /> {/* bottom spacer */}
      </div>
    </motion.div>
  )
}
