import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, SlidersHorizontal, Moon, Sun } from 'lucide-react'
import BackButton from './BackButton'
import { efficiency, heatAbsorbed, heatRejected, netWork, copR } from '../utils/carnotPhysics'
import { useApp } from '../context/AppContext'

// ── SVG layout constants ──────────────────────────────────────────────────────
const SW = 660, SH = 560
const CYL_X = 200, CYL_W = 180
const CYL_TOP = 125, CYL_BOT = 390
const CYL_MID = CYL_X + CYL_W / 2          // 290
const PISTON_H = 22, PISTON_PAD = 4
const CRANK_CX = 490, CRANK_CY = 258
const CRANK_R = 65, ROD_LEN = 110
const WHEEL_CX = 560, WHEEL_CY = 258, WHEEL_R = 50
const RES_X = 148, RES_W = 280
const HOT_Y = 10, HOT_H = 78
const COLD_Y = 458, COLD_H = 78

function pistonY(angle) {
  const cpX = CRANK_CX + CRANK_R * Math.cos(angle)
  const cpY = CRANK_CY + CRANK_R * Math.sin(angle)
  const dx = CYL_MID - cpX
  return cpY - Math.sqrt(Math.max(0, ROD_LEN * ROD_LEN - dx * dx))
}

function lerp(a, b, t) { return a + (b - a) * t }

// ── Flame particles above hot reservoir ──────────────────────────────────────
function Flames({ active, speed }) {
  if (!active) return null
  return (
    <>
      {[0, 1, 2, 3, 4, 5, 6].map(i => {
        const x = RES_X + 28 + i * (RES_W - 56) / 6
        const dur = (0.55 + (i % 3) * 0.15) / speed
        return (
          <motion.ellipse key={i}
            cx={x} cy={HOT_Y + HOT_H - 6}
            rx={4 + (i % 3)} ry={7 + (i % 4) * 3}
            fill={i % 2 === 0 ? '#f97316' : '#fbbf24'}
            fillOpacity={0.82}
            animate={{ cy: [HOT_Y + HOT_H - 6, HOT_Y + HOT_H - 26, HOT_Y + HOT_H - 6], scaleY: [1, 1.5, 1], opacity: [0.9, 0.5, 0.9] }}
            transition={{ duration: dur, repeat: Infinity, delay: i * 0.09, ease: 'easeInOut' }}
          />
        )
      })}
    </>
  )
}

// ── Snowflakes in cold reservoir ──────────────────────────────────────────────
function Snowflakes({ active }) {
  if (!active) return null
  return (
    <>
      {[0, 1, 2, 3, 4].map(i => {
        const x = RES_X + 32 + i * (RES_W - 64) / 4
        const cy = COLD_Y + COLD_H / 2
        return (
          <motion.g key={i}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 4 + i * 0.6, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: `${x}px ${cy}px` }}
          >
            {[0, 60, 120].map(a => {
              const r = a * Math.PI / 180
              return <line key={a} x1={x - 7 * Math.cos(r)} y1={cy - 7 * Math.sin(r)} x2={x + 7 * Math.cos(r)} y2={cy + 7 * Math.sin(r)} stroke="#93c5fd" strokeWidth="1.5" strokeOpacity="0.7" />
            })}
          </motion.g>
        )
      })}
    </>
  )
}

// ── Heat particles Q_H (hot res → cylinder top) ───────────────────────────────
function QHParticles({ active, speed }) {
  if (!active) return null
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <motion.circle key={i} r={4} fill="#f97316" fillOpacity={0.9}
          animate={{
            cx: [CYL_MID + (i % 2 === 0 ? -18 : 18), CYL_MID + (i % 2 === 0 ? -4 : 4)],
            cy: [HOT_Y + HOT_H + 2, CYL_TOP + 14],
            opacity: [0, 1, 1, 0], r: [5, 3, 2],
          }}
          transition={{ duration: 0.85 / speed, repeat: Infinity, delay: i * 0.21, ease: 'easeIn' }}
        />
      ))}
    </>
  )
}

// ── Heat particles Q_C (cylinder bottom → cold res) ───────────────────────────
function QCParticles({ active, speed }) {
  if (!active) return null
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <motion.circle key={i} r={4} fill="#3b82f6" fillOpacity={0.9}
          animate={{
            cx: [CYL_MID + (i % 2 === 0 ? -14 : 14), CYL_MID + (i % 2 === 0 ? -24 : 24)],
            cy: [CYL_BOT - 14, COLD_Y - 2],
            opacity: [0, 1, 1, 0], r: [4, 3, 2],
          }}
          transition={{ duration: 0.85 / speed, repeat: Infinity, delay: i * 0.21, ease: 'easeOut' }}
        />
      ))}
    </>
  )
}

// ── Flywheel ──────────────────────────────────────────────────────────────────
function Wheel({ angle }) {
  return (
    <g>
      <circle cx={WHEEL_CX} cy={WHEEL_CY} r={WHEEL_R} fill="none" stroke="#d97706" strokeWidth="6" />
      <circle cx={WHEEL_CX} cy={WHEEL_CY} r={WHEEL_R - 11} fill="none" stroke="#fef08a" strokeWidth="1" strokeOpacity="0.25" />
      <circle cx={WHEEL_CX} cy={WHEEL_CY} r={8} fill="#eab308" />
      {[0, 1, 2, 3, 4, 5].map(i => {
        const a = angle + i * Math.PI / 3
        return <line key={i}
          x1={WHEEL_CX + 8 * Math.cos(a)} y1={WHEEL_CY + 8 * Math.sin(a)}
          x2={WHEEL_CX + (WHEEL_R - 4) * Math.cos(a)} y2={WHEEL_CY + (WHEEL_R - 4) * Math.sin(a)}
          stroke="#eab308" strokeWidth="3" strokeLinecap="round" />
      })}
    </g>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
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
  const rafRef = useRef(null)
  const lastRef = useRef(null)

  useEffect(() => {
    if (!isPlaying) { cancelAnimationFrame(rafRef.current); lastRef.current = null; return }
    const radsPerMs = (speed * 60 * 2 * Math.PI) / 60000
    const tick = (ts) => {
      if (lastRef.current != null) setAngle(a => a + radsPerMs * (ts - lastRef.current))
      lastRef.current = ts
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(rafRef.current); lastRef.current = null }
  }, [isPlaying, speed])

  const reset = () => { setIsPlaying(false); setAngle(-Math.PI / 2) }

  // physics
  const eta = T_H > T_C ? efficiency(T_H, T_C) : 0
  const Q_H = heatAbsorbed(n, T_H, V1, V2)
  const Q_C = Math.abs(heatRejected(n, T_C, V2 * Math.pow(T_H / T_C, 2.5), V1 * Math.pow(T_H / T_C, 2.5)))
  const W_net = netWork(Q_H, Q_C)
  const COP_R = T_H > T_C ? copR(T_H, T_C) : 0

  const fmt = v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(2) + 'k' : v.toFixed(1)

  // geometry
  const pY = pistonY(angle)
  const pTop = Math.max(CYL_TOP, Math.min(CYL_BOT - PISTON_H - 2, pY))
  const pBot = pTop + PISTON_H
  const cpX = CRANK_CX + CRANK_R * Math.cos(angle)
  const cpY = CRANK_CY + CRANK_R * Math.sin(angle)

  // gas color
  const ratio = Math.max(0, Math.min(1, 1 - (pTop - CYL_TOP) / (CYL_BOT - CYL_TOP - PISTON_H)))
  const gasColor = `rgba(${Math.round(lerp(59, 249, ratio))},${Math.round(lerp(130, 115, ratio))},${Math.round(lerp(246, 22, ratio))},0.42)`
  const gasEdge = `rgb(${Math.round(lerp(59, 249, ratio))},${Math.round(lerp(130, 115, ratio))},${Math.round(lerp(246, 22, ratio))})`
  const gasT = Math.round(lerp(T_C, T_H, ratio))

  // phase
  const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  const expanding = norm < Math.PI
  const qhActive = isPlaying && expanding
  const qcActive = isPlaying && !expanding

  // efficiency gauge
  const gCX = CYL_MID, gCY = CYL_TOP - 52, gR = 28
  const arc = eta * Math.PI * 1.5
  const gColor = eta > 0.6 ? '#22c55e' : eta > 0.35 ? '#f59e0b' : '#ef4444'
  const ex = gCX + gR * Math.cos(Math.PI + arc), ey = gCY + gR * Math.sin(Math.PI + arc)

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
      className="min-h-screen bg-[#fafafa] dark:bg-[#0f172a] transition-colors duration-300">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
        <BackButton />
        <div className="text-center">
          <h1 className="font-serif text-2xl font-bold text-gray-900 dark:text-white">Carnot Engine</h1>
          <p className="font-sans text-xs text-gray-400 mt-0.5">Mechanical cross-section · live simulation</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSliders(!showSliders)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm font-sans transition-colors">
            <SlidersHorizontal size={15} /><span>Params</span>
          </button>
          <button onClick={() => setDarkMode(!darkMode)}
            className="w-8 h-8 rounded-full bg-white dark:bg-[#1e293b] shadow-sm flex items-center justify-center text-gray-500 dark:text-gray-300 transition-colors">
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {/* Sliders */}
      <AnimatePresence>
        {showSliders && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1e293b]">
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'T_H (K)', value: T_H, set: setTH, min: 301, max: 1500, step: 10 },
                { label: 'T_C (K)', value: T_C, set: setTC, min: 50, max: 899, step: 10 },
                { label: 'n (mol)', value: n, set: setN, min: 0.1, max: 5, step: 0.1 },
                { label: 'V₁ (L)', value: V1, set: setV1, min: 0.1, max: 5, step: 0.1 },
                { label: 'V₂ (L)', value: V2, set: setV2, min: 0.5, max: 20, step: 0.5 },
              ].map(s => (
                <div key={s.label} className="space-y-1">
                  <div className="flex justify-between">
                    <label className="font-mono text-xs text-gray-500 dark:text-gray-400">{s.label}</label>
                    <span className="font-mono text-xs text-amber-600 dark:text-amber-400">{s.value}</span>
                  </div>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                    onChange={e => s.set(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded accent-amber-500" />
                </div>
              ))}
            </div>
            {T_H <= T_C && <p className="px-6 pb-3 font-sans text-xs text-red-500">T_H must be greater than T_C</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SVG Engine */}
      <div className="flex justify-center px-4 py-4">
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden w-full max-w-3xl">
          <svg viewBox={`0 0 ${SW} ${SH}`} width="100%" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="hotG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#991b1b" /><stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
              <linearGradient id="coldG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e40af" /><stop offset="100%" stopColor="#1e3a8a" />
              </linearGradient>
              <linearGradient id="wallG" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#64748b" /><stop offset="20%" stopColor="#cbd5e1" />
                <stop offset="80%" stopColor="#cbd5e1" /><stop offset="100%" stopColor="#64748b" />
              </linearGradient>
              <linearGradient id="pistG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e2e8f0" /><stop offset="60%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
              <linearGradient id="crankG" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#334155" /><stop offset="100%" stopColor="#94a3b8" />
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

            {/* subtle grid */}
            {Array.from({ length: 12 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 50} x2={SW} y2={i * 50} stroke="#e2e8f0" strokeWidth="0.4" strokeOpacity="0.35" />)}
            {Array.from({ length: 14 }, (_, i) => <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2={SH} stroke="#e2e8f0" strokeWidth="0.4" strokeOpacity="0.35" />)}

            {/* ── HOT RESERVOIR ── */}
            <rect x={RES_X} y={HOT_Y} width={RES_W} height={HOT_H} rx="12" fill="url(#hotG)" />
            <rect x={RES_X} y={HOT_Y} width={RES_W} height={HOT_H} rx="12" fill="none" stroke="#ef4444" strokeWidth="2" strokeOpacity="0.5" />
            <rect x={RES_X + 12} y={HOT_Y + 8} width={RES_W - 24} height="7" rx="3.5" fill="white" fillOpacity="0.07" />
            <text x={RES_X + RES_W / 2} y={HOT_Y + 27} textAnchor="middle" fill="#fca5a5" fontSize="10.5" fontFamily="monospace" fontWeight="700" letterSpacing="2">HOT RESERVOIR</text>
            <text x={RES_X + RES_W / 2} y={HOT_Y + 47} textAnchor="middle" fill="white" fontSize="14" fontFamily="monospace" fontWeight="600">T_H = {T_H} K</text>
            <text x={RES_X + RES_W / 2} y={HOT_Y + 65} textAnchor="middle" fill="#fb923c" fontSize="10" fontFamily="monospace">Q_H = {fmt(Q_H)} J</text>
            <Flames active={isPlaying} speed={speed} />

            {/* ── COLD RESERVOIR ── */}
            <rect x={RES_X} y={COLD_Y} width={RES_W} height={COLD_H} rx="12" fill="url(#coldG)" />
            <rect x={RES_X} y={COLD_Y} width={RES_W} height={COLD_H} rx="12" fill="none" stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.5" />
            <rect x={RES_X + 12} y={COLD_Y + 8} width={RES_W - 24} height="7" rx="3.5" fill="white" fillOpacity="0.06" />
            <text x={RES_X + RES_W / 2} y={COLD_Y + 27} textAnchor="middle" fill="#93c5fd" fontSize="10.5" fontFamily="monospace" fontWeight="700" letterSpacing="2">COLD RESERVOIR</text>
            <text x={RES_X + RES_W / 2} y={COLD_Y + 47} textAnchor="middle" fill="white" fontSize="14" fontFamily="monospace" fontWeight="600">T_C = {T_C} K</text>
            <text x={RES_X + RES_W / 2} y={COLD_Y + 65} textAnchor="middle" fill="#60a5fa" fontSize="10" fontFamily="monospace">Q_C = {fmt(Q_C)} J</text>
            <Snowflakes active={isPlaying} />

            {/* ── Q_H path ── */}
            <line x1={CYL_MID} y1={HOT_Y + HOT_H} x2={CYL_MID} y2={CYL_TOP}
              stroke="#ef4444" strokeWidth="2.5" strokeDasharray="7,4"
              strokeOpacity={qhActive ? 0.95 : 0.25} markerEnd="url(#arrowH)" />
            <rect x={CYL_MID + 6} y={HOT_Y + HOT_H + 4} width="56" height="17" rx="5" fill="#fef2f2" fillOpacity="0.92" />
            <text x={CYL_MID + 34} y={HOT_Y + HOT_H + 17} textAnchor="middle" fill="#ef4444" fontSize="10" fontFamily="monospace" fontWeight="600">Q_H in</text>
            <QHParticles active={qhActive} speed={speed} />

            {/* ── Q_C path ── */}
            <line x1={CYL_MID} y1={CYL_BOT} x2={CYL_MID} y2={COLD_Y}
              stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="7,4"
              strokeOpacity={qcActive ? 0.95 : 0.25} markerEnd="url(#arrowC)" />
            <rect x={CYL_MID + 6} y={CYL_BOT + 6} width="58" height="17" rx="5" fill="#eff6ff" fillOpacity="0.92" />
            <text x={CYL_MID + 35} y={CYL_BOT + 19} textAnchor="middle" fill="#3b82f6" fontSize="10" fontFamily="monospace" fontWeight="600">Q_C out</text>
            <QCParticles active={qcActive} speed={speed} />

            {/* ── CYLINDER WALLS ── */}
            <rect x={CYL_X - 18} y={CYL_TOP - 12} width={CYL_W + 36} height={CYL_BOT - CYL_TOP + 24} rx="7" fill="url(#wallG)" />
            {/* cylinder interior */}
            <rect x={CYL_X} y={CYL_TOP} width={CYL_W} height={CYL_BOT - CYL_TOP} fill="#1e293b" />

            {/* gas fill */}
            {pBot < CYL_BOT && (
              <>
                <rect x={CYL_X + 2} y={pBot} width={CYL_W - 4} height={Math.max(0, CYL_BOT - pBot)}
                  fill={gasColor} filter="url(#glow)" />
                <rect x={CYL_X + 2} y={pBot} width={CYL_W - 4} height="4" fill={gasEdge} fillOpacity="0.55" />
              </>
            )}

            {/* gas temp label */}
            {CYL_BOT - pBot > 35 && (
              <text x={CYL_MID} y={(pBot + CYL_BOT) / 2 + 5} textAnchor="middle"
                fill="white" fillOpacity="0.65" fontSize="11" fontFamily="monospace" fontWeight="600">
                T ≈ {gasT} K
              </text>
            )}

            {/* ── PISTON ROD ── */}
            <line x1={CYL_MID} y1={CYL_TOP - 12} x2={CYL_MID} y2={pTop}
              stroke="#64748b" strokeWidth="10" strokeLinecap="round" />
            <line x1={CYL_MID} y1={CYL_TOP - 12} x2={CYL_MID} y2={pTop}
              stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />

            {/* ── PISTON ── */}
            <rect x={CYL_X + PISTON_PAD} y={pTop} width={CYL_W - PISTON_PAD * 2} height={PISTON_H} rx="3" fill="url(#pistG)" />
            <rect x={CYL_X + PISTON_PAD} y={pTop} width={CYL_W - PISTON_PAD * 2} height="5" rx="2" fill="#475569" />
            <rect x={CYL_X + PISTON_PAD} y={pTop + PISTON_H - 5} width={CYL_W - PISTON_PAD * 2} height="5" rx="2" fill="#475569" />
            <rect x={CYL_X + PISTON_PAD + 6} y={pTop + 7} width={(CYL_W / 2) - 16} height="3" rx="1.5" fill="white" fillOpacity="0.35" />

            {/* ── CONNECTING ROD ── */}
            <line x1={CYL_MID} y1={pTop + PISTON_H / 2} x2={cpX} y2={cpY}
              stroke="#334155" strokeWidth="8" strokeLinecap="round" />
            <line x1={CYL_MID} y1={pTop + PISTON_H / 2} x2={cpX} y2={cpY}
              stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
            <circle cx={cpX} cy={cpY} r="7" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
            <circle cx={CYL_MID} cy={pTop + PISTON_H / 2} r="5" fill="#334155" stroke="#94a3b8" strokeWidth="2" />

            {/* ── CRANKSHAFT ── */}
            <line x1={CRANK_CX} y1={CRANK_CY} x2={cpX} y2={cpY}
              stroke="url(#crankG)" strokeWidth="11" strokeLinecap="round" />
            <line x1={CRANK_CX} y1={CRANK_CY} x2={WHEEL_CX} y2={WHEEL_CY}
              stroke="#475569" strokeWidth="11" strokeLinecap="round" />
            <line x1={CRANK_CX} y1={CRANK_CY} x2={WHEEL_CX} y2={WHEEL_CY}
              stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
            <circle cx={CRANK_CX} cy={CRANK_CY} r="13" fill="#1e293b" stroke="#64748b" strokeWidth="3" />
            <circle cx={CRANK_CX} cy={CRANK_CY} r="5" fill="#94a3b8" />

            {/* ── FLYWHEEL ── */}
            <Wheel angle={angle} />

            {/* ── W_NET ARROW ── */}
            <line x1={WHEEL_CX + WHEEL_R + 2} y1={WHEEL_CY} x2={WHEEL_CX + WHEEL_R + 52} y2={WHEEL_CY}
              stroke="#eab308" strokeWidth="3.5" markerEnd="url(#arrowW)" />
            <rect x={WHEEL_CX + WHEEL_R + 4} y={WHEEL_CY - 23} width="58" height="16" rx="4" fill="#fefce8" fillOpacity="0.92" />
            <text x={WHEEL_CX + WHEEL_R + 33} y={WHEEL_CY - 11} textAnchor="middle" fill="#854d0e" fontSize="10" fontFamily="monospace" fontWeight="700">W_net</text>
            <text x={WHEEL_CX + WHEEL_R + 33} y={WHEEL_CY + 18} textAnchor="middle" fill="#eab308" fontSize="11" fontFamily="monospace" fontWeight="700">{fmt(W_net)} J</text>

            {/* ── EFFICIENCY GAUGE (above cylinder) ── */}
            <path d={`M ${gCX - gR} ${gCY} A ${gR} ${gR} 0 1 1 ${gCX + gR} ${gCY}`}
              fill="none" stroke="#e2e8f0" strokeWidth="5.5" strokeLinecap="round" />
            <path d={`M ${gCX - gR} ${gCY} A ${gR} ${gR} 0 ${arc > Math.PI ? 1 : 0} 1 ${ex} ${ey}`}
              fill="none" stroke={gColor} strokeWidth="5.5" strokeLinecap="round" />
            <text x={gCX} y={gCY - 3} textAnchor="middle" fill={gColor} fontSize="13" fontFamily="monospace" fontWeight="800">{(eta * 100).toFixed(1)}%</text>
            <text x={gCX} y={gCY + 11} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace">η</text>

            {/* cylinder bolt decorations */}
            {[CYL_TOP + 22, CYL_TOP + 64, CYL_BOT - 64, CYL_BOT - 22].map((y, i) => (
              <g key={i}>
                <circle cx={CYL_X - 10} cy={y} r="4" fill="#94a3b8" />
                <circle cx={CYL_X + CYL_W + 10} cy={y} r="4" fill="#94a3b8" />
                <circle cx={CYL_X - 10} cy={y} r="1.5" fill="#e2e8f0" />
                <circle cx={CYL_X + CYL_W + 10} cy={y} r="1.5" fill="#e2e8f0" />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 pt-1 pb-4">
        <button onClick={reset}
          className="w-9 h-9 rounded-full bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
          <RotateCcw size={15} />
        </button>
        <button onClick={() => setIsPlaying(!isPlaying)}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg,#3b82f6,#4f46e5)' }}>
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-gray-400">Speed</span>
          <input type="range" min={0.5} max={4} step={0.5} value={speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
            className="w-24 h-1.5 accent-blue-500" />
          <span className="font-mono text-xs text-blue-500 w-6">{speed}×</span>
        </div>
      </div>

      {/* Value Strip */}
      <div className="max-w-2xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'η', value: `${(eta * 100).toFixed(1)}%`, color: '#22c55e' },
            { label: 'Q_H', value: `${fmt(Q_H)} J`, color: '#ef4444' },
            { label: 'Q_C', value: `${fmt(Q_C)} J`, color: '#3b82f6' },
            { label: 'W_net', value: `${fmt(W_net)} J`, color: '#eab308' },
            { label: 'COP_R', value: COP_R.toFixed(3), color: '#a855f7' },
          ].map(item => (
            <div key={item.label} className="bg-white dark:bg-[#1e293b] rounded-xl border border-gray-100 dark:border-gray-800 p-3 text-center shadow-sm">
              <p className="font-mono text-xs text-gray-400 mb-1">{item.label}</p>
              <p className="font-mono text-sm font-semibold" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
