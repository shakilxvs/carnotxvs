import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, SlidersHorizontal, Moon, Sun, Zap } from 'lucide-react'
import BackButton from './BackButton'
import { efficiency, heatAbsorbed, heatRejected, netWork, copR } from '../utils/carnotPhysics'
import { useApp } from '../context/AppContext'

// ── Layout constants (SVG coordinate space) ──────────────────────────────────
const SW = 720, SH = 600

// Cylinder
const CX = 260, CY_TOP = 130, CY_BOT = 410, CW = 160
const CY_MID = CX + CW / 2   // 340
const PST_H = 24

// Crank + flywheel
const CR_CX = 530, CR_CY = 270, CR_R = 72
const FW_CX = 530, FW_CY = 270, FW_R = 58
const ROD_LEN = 118

// Reservoirs
const RES_X = 160, RES_W = 360
const HOT_Y = 8,  HOT_H = 86
const CLD_Y = 506, CLD_H = 86

// ── helpers ───────────────────────────────────────────────────────────────────
function pistonY(angle) {
  const cpX = CR_CX + CR_R * Math.cos(angle)
  const cpY = CR_CY + CR_R * Math.sin(angle)
  const dx = CY_MID - cpX
  return cpY - Math.sqrt(Math.max(0, ROD_LEN * ROD_LEN - dx * dx))
}
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// ── Mist / gas effect ─────────────────────────────────────────────────────────
function GasMist({ pTop, gasRatio, isPlaying, speed }) {
  const gasH = Math.max(0, CY_BOT - (pTop + PST_H))
  const gasY = pTop + PST_H
  if (gasH < 4) return null

  // colour shifts hot↔cold with piston position
  const r = Math.round(lerp(59, 239, gasRatio))
  const g = Math.round(lerp(130, 68,  gasRatio))
  const b = Math.round(lerp(246, 68,  gasRatio))
  const mid = `rgba(${r},${g},${b},`

  return (
    <g>
      {/* base fill */}
      <rect
        x={CX + 2} y={gasY}
        width={CW - 4} height={gasH}
        fill={`rgba(${r},${g},${b},0.12)`}
        rx="1"
      />
      {/* mist layers — turbulence via animated clipPath positions */}
      {[0.18, 0.32, 0.22, 0.15, 0.10].map((op, i) => {
        const yOff = gasY + (i / 5) * gasH
        const hh   = gasH / 3.5
        return (
          <motion.ellipse
            key={i}
            cx={CY_MID + (i % 2 === 0 ? 14 : -14)}
            cy={yOff + hh / 2}
            rx={CW * 0.38 + i * 5}
            ry={hh * 0.7}
            fill={`${mid}${op})`}
            animate={isPlaying ? {
              cx: [CY_MID + (i%2===0?12:-12), CY_MID + (i%2===0?-10:10), CY_MID + (i%2===0?12:-12)],
              ry: [hh*0.65, hh*0.95, hh*0.65],
              opacity: [op, op*1.5, op],
            } : { opacity: op }}
            transition={{ duration: (1.4 + i * 0.3) / (speed || 1), repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
          />
        )
      })}
      {/* bright top edge where piston meets gas */}
      <rect
        x={CX + 2} y={gasY}
        width={CW - 4} height={3}
        fill={`rgba(${r},${g},${b},0.55)`}
        rx="1"
      />
      {/* temperature shimmer streaks */}
      {gasH > 60 && [0.3, 0.55, 0.75].map((frac, i) => (
        <motion.rect
          key={i}
          x={CX + 8 + i * 38}
          y={gasY + gasH * frac}
          width={CW * 0.22}
          height={1.5}
          rx="1"
          fill={`rgba(${r},${g},${b},0.6)`}
          animate={isPlaying ? { opacity: [0.6, 0.1, 0.6], scaleX: [1, 0.5, 1] } : { opacity: 0.4 }}
          transition={{ duration: (0.6 + i * 0.2) / (speed || 1), repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
          style={{ transformOrigin: `${CX + 8 + i * 38}px ${gasY + gasH * frac}px` }}
        />
      ))}
    </g>
  )
}

// ── Flame particles (above hot reservoir) ─────────────────────────────────────
function Flames({ active, speed }) {
  if (!active) return null
  return (
    <>
      {[0,1,2,3,4,5].map(i => {
        const x   = RES_X + 36 + i * (RES_W - 72) / 5
        const dur = (0.5 + (i % 3) * 0.18) / speed
        const col = i % 2 === 0 ? '#f97316' : '#fbbf24'
        return (
          <motion.ellipse key={i}
            cx={x} cy={HOT_Y + HOT_H - 6}
            rx={3 + i%3} ry={6 + (i%4)*4}
            fill={col} fillOpacity={0.85}
            animate={{
              cy:     [HOT_Y+HOT_H-6, HOT_Y+HOT_H-28, HOT_Y+HOT_H-6],
              scaleY: [1, 1.6, 1],
              opacity:[0.9, 0.45, 0.9],
            }}
            transition={{ duration: dur, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
          />
        )
      })}
    </>
  )
}

// ── Snowflakes (cold reservoir) ───────────────────────────────────────────────
function Snowflakes({ active }) {
  if (!active) return null
  return (
    <>
      {[0,1,2,3,4].map(i => {
        const x  = RES_X + 40 + i * (RES_W - 80) / 4
        const cy = CLD_Y + CLD_H / 2
        return (
          <motion.g key={i}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 5 + i * 0.5, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: `${x}px ${cy}px` }}
          >
            {[0, 60, 120].map(a => {
              const r = a * Math.PI / 180
              return <line key={a}
                x1={x - 8*Math.cos(r)} y1={cy - 8*Math.sin(r)}
                x2={x + 8*Math.cos(r)} y2={cy + 8*Math.sin(r)}
                stroke="#7dd3fc" strokeWidth="1.5" strokeOpacity="0.65" />
            })}
          </motion.g>
        )
      })}
    </>
  )
}

// ── Heat particles Q_H (hot → cyl) ───────────────────────────────────────────
function QHParticles({ active, speed }) {
  if (!active) return null
  return (
    <>
      {[0,1,2,3].map(i => (
        <motion.circle key={i} r={4.5}
          fill={i%2===0?'#f97316':'#fbbf24'} fillOpacity={0.9}
          animate={{
            cx:      [CY_MID + (i%2===0?-16:16), CY_MID + (i%2===0?-4:4)],
            cy:      [HOT_Y + HOT_H + 4, CY_TOP + 16],
            opacity: [0, 1, 1, 0],
            r:       [5, 3.5, 2],
          }}
          transition={{ duration: 0.8/speed, repeat: Infinity, delay: i*0.2, ease: 'easeIn' }}
        />
      ))}
    </>
  )
}

// ── Heat particles Q_C (cyl → cold) ──────────────────────────────────────────
function QCParticles({ active, speed }) {
  if (!active) return null
  return (
    <>
      {[0,1,2,3].map(i => (
        <motion.circle key={i} r={4}
          fill={i%2===0?'#60a5fa':'#93c5fd'} fillOpacity={0.9}
          animate={{
            cx:      [CY_MID + (i%2===0?-12:12), CY_MID + (i%2===0?-22:22)],
            cy:      [CY_BOT - 12, CLD_Y - 4],
            opacity: [0, 1, 1, 0],
            r:       [4, 3, 2],
          }}
          transition={{ duration: 0.8/speed, repeat: Infinity, delay: i*0.2, ease: 'easeOut' }}
        />
      ))}
    </>
  )
}

// ── Flywheel SVG ──────────────────────────────────────────────────────────────
function Flywheel({ angle }) {
  const spokes = 8
  return (
    <g>
      {/* rim shadow */}
      <circle cx={FW_CX+2} cy={FW_CY+2} r={FW_R} fill="rgba(0,0,0,0.2)" />
      {/* outer rim */}
      <circle cx={FW_CX} cy={FW_CY} r={FW_R} fill="none" stroke="#92400e" strokeWidth="10" />
      <circle cx={FW_CX} cy={FW_CY} r={FW_R} fill="none" stroke="#fbbf24" strokeWidth="4" />
      <circle cx={FW_CX} cy={FW_CY} r={FW_R-14} fill="none" stroke="#d97706" strokeWidth="1.5" strokeOpacity="0.4" />
      {/* spokes */}
      {Array.from({length: spokes}, (_,i) => {
        const a = angle + i * Math.PI * 2 / spokes
        return (
          <line key={i}
            x1={FW_CX + 9*Math.cos(a)} y1={FW_CY + 9*Math.sin(a)}
            x2={FW_CX + (FW_R-8)*Math.cos(a)} y2={FW_CY + (FW_R-8)*Math.sin(a)}
            stroke="#d97706" strokeWidth="3" strokeLinecap="round" />
        )
      })}
      {/* hub */}
      <circle cx={FW_CX} cy={FW_CY} r={11} fill="#1c1917" stroke="#d97706" strokeWidth="2.5" />
      <circle cx={FW_CX} cy={FW_CY} r={5}  fill="#fbbf24" />
    </g>
  )
}

// ── Efficiency arc gauge ──────────────────────────────────────────────────────
function EtaGauge({ eta }) {
  const gCX = CY_MID, gCY = CY_TOP - 58, gR = 30
  const arc  = clamp(eta, 0, 1) * Math.PI * 1.5
  const col  = eta > 0.6 ? '#22c55e' : eta > 0.35 ? '#f59e0b' : '#ef4444'
  const ex   = gCX + gR * Math.cos(Math.PI + arc)
  const ey   = gCY + gR * Math.sin(Math.PI + arc)
  return (
    <g>
      <path d={`M ${gCX-gR} ${gCY} A ${gR} ${gR} 0 1 1 ${gCX+gR} ${gCY}`}
        fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="6" strokeLinecap="round" />
      {eta > 0 && (
        <path d={`M ${gCX-gR} ${gCY} A ${gR} ${gR} 0 ${arc>Math.PI?1:0} 1 ${ex} ${ey}`}
          fill="none" stroke={col} strokeWidth="6" strokeLinecap="round" />
      )}
      <text x={gCX} y={gCY-2} textAnchor="middle" fill={col}
        fontSize="13" fontFamily="'JetBrains Mono',monospace" fontWeight="800">
        {(eta*100).toFixed(1)}%
      </text>
      <text x={gCX} y={gCY+13} textAnchor="middle" fill="#94a3b8"
        fontSize="9" fontFamily="monospace" letterSpacing="2">η</text>
    </g>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EngineModule() {
  const { darkMode, setDarkMode } = useApp()
  const [T_H,  setTH]   = useState(800)
  const [T_C,  setTC]   = useState(300)
  const [n,    setN]    = useState(1)
  const [V1,   setV1]   = useState(1)
  const [V2,   setV2]   = useState(4)
  const [isPlaying,    setIsPlaying]   = useState(false)
  const [speed,        setSpeed]       = useState(1)
  const [showSliders,  setShowSliders] = useState(false)
  const [angle,        setAngle]       = useState(-Math.PI / 2)

  const rafRef  = useRef(null)
  const lastRef = useRef(null)

  // animation loop
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
  const eta   = T_H > T_C ? efficiency(T_H, T_C) : 0
  const Q_H   = heatAbsorbed(n, T_H, V1, V2)
  const Q_C   = Math.abs(heatRejected(n, T_C, V2 * Math.pow(T_H/T_C, 2.5), V1 * Math.pow(T_H/T_C, 2.5)))
  const W_net = netWork(Q_H, Q_C)
  const COP_R = T_H > T_C ? copR(T_H, T_C) : 0
  const fmt   = v => Math.abs(v)>=1e6?(v/1e6).toFixed(2)+'M':Math.abs(v)>=1e3?(v/1e3).toFixed(2)+'k':v.toFixed(1)

  // geometry
  const rawPY  = pistonY(angle)
  const pTop   = clamp(rawPY, CY_TOP, CY_BOT - PST_H - 2)
  const pBot   = pTop + PST_H
  const cpX    = CR_CX + CR_R * Math.cos(angle)
  const cpY    = CR_CY + CR_R * Math.sin(angle)

  // gas state
  const gasRatio = clamp(1 - (pTop - CY_TOP) / (CY_BOT - CY_TOP - PST_H), 0, 1)
  const gasT     = Math.round(lerp(T_C, T_H, gasRatio))

  // phase
  const norm      = ((angle % (Math.PI*2)) + Math.PI*2) % (Math.PI*2)
  const expanding = norm < Math.PI
  const qhActive  = isPlaying && expanding
  const qcActive  = isPlaying && !expanding

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      className="min-h-screen bg-[#fafafa] dark:bg-[#0a0f1e] transition-colors duration-300 flex flex-col"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800/60 bg-white dark:bg-[#0f172a]">
        <BackButton />
        <div className="text-center">
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Carnot Engine
          </h1>
          <p className="font-sans text-[11px] text-gray-400 mt-0.5 tracking-wide">
            Mechanical cross-section · live simulation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSliders(!showSliders)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-xs font-medium transition-all hover:shadow-sm"
          >
            <SlidersHorizontal size={13} />
            <span className="hidden sm:inline">Params</span>
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-8 h-8 rounded-full bg-gray-50 dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-[#334155]"
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* ── Param sliders ── */}
      <AnimatePresence>
        {showSliders && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1e293b]"
          >
            <div className="px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {[
                { label:'T_H (K)', val:T_H, set:setTH, min:301,  max:1500, step:10  },
                { label:'T_C (K)', val:T_C, set:setTC, min:50,   max:899,  step:10  },
                { label:'n (mol)', val:n,   set:setN,  min:0.1,  max:5,    step:0.1 },
                { label:'V₁ (L)', val:V1,  set:setV1, min:0.1,  max:5,    step:0.1 },
                { label:'V₂ (L)', val:V2,  set:setV2, min:0.5,  max:20,   step:0.5 },
              ].map(s => (
                <div key={s.label} className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className="font-mono text-xs text-gray-500 dark:text-gray-400">{s.label}</label>
                    <span className="font-mono text-xs text-amber-500 font-semibold">{s.val}</span>
                  </div>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={s.val}
                    onChange={e => s.set(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full accent-amber-500 cursor-pointer" />
                </div>
              ))}
            </div>
            {T_H <= T_C && (
              <p className="px-6 pb-3 font-sans text-xs text-red-400 font-medium">
                T_H must be greater than T_C for a valid Carnot cycle
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SVG Engine ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 sm:px-6 py-4 gap-4">
        <div className="w-full max-w-2xl">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800/80 overflow-hidden">
            <svg viewBox={`0 0 ${SW} ${SH}`} width="100%" style={{ display: 'block' }}>
              <defs>
                {/* reservoirs */}
                <linearGradient id="eHotG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#7f1d1d" />
                  <stop offset="100%" stopColor="#991b1b" />
                </linearGradient>
                <linearGradient id="eColdG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#1e3a8a" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
                {/* cylinder wall gradient */}
                <linearGradient id="eWallG" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor="#374151" />
                  <stop offset="12%"  stopColor="#9ca3af" />
                  <stop offset="50%"  stopColor="#e5e7eb" />
                  <stop offset="88%"  stopColor="#9ca3af" />
                  <stop offset="100%" stopColor="#374151" />
                </linearGradient>
                {/* piston gradient */}
                <linearGradient id="ePistG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#f1f5f9" />
                  <stop offset="50%"  stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#334155" />
                </linearGradient>
                {/* crank gradient */}
                <linearGradient id="eCrankG" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#64748b" />
                </linearGradient>
                {/* piston rod */}
                <linearGradient id="eRodG" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor="#1e293b" />
                  <stop offset="40%"  stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
                {/* glow filter */}
                <filter id="eGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                {/* subtle drop shadow */}
                <filter id="eDrop" x="-5%" y="-5%" width="110%" height="115%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.25" />
                </filter>
                {/* arrow markers */}
                <marker id="eArrowW" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#fbbf24" />
                </marker>
                <marker id="eArrowH" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                  <path d="M0,0 L7,3.5 L0,7 Z" fill="#f97316" />
                </marker>
                <marker id="eArrowC" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                  <path d="M0,0 L7,3.5 L0,7 Z" fill="#60a5fa" />
                </marker>
              </defs>

              {/* ── subtle grid ── */}
              {Array.from({length:13},(_,i)=>(
                <line key={`g${i}`} x1="0" y1={i*50} x2={SW} y2={i*50}
                  stroke="#e5e7eb" strokeWidth="0.4" strokeOpacity="0.18" />
              ))}
              {Array.from({length:15},(_,i)=>(
                <line key={`v${i}`} x1={i*50} y1="0" x2={i*50} y2={SH}
                  stroke="#e5e7eb" strokeWidth="0.4" strokeOpacity="0.18" />
              ))}

              {/* ═══════════════════════════════════════════════════════════
                  HOT RESERVOIR
              ════════════════════════════════════════════════════════════ */}
              <rect x={RES_X} y={HOT_Y} width={RES_W} height={HOT_H} rx="14"
                fill="url(#eHotG)" filter="url(#eDrop)" />
              {/* inner highlight strip */}
              <rect x={RES_X+14} y={HOT_Y+10} width={RES_W-28} height="8" rx="4"
                fill="white" fillOpacity="0.06" />
              {/* border glow */}
              <rect x={RES_X} y={HOT_Y} width={RES_W} height={HOT_H} rx="14"
                fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.55" />

              <text x={RES_X+RES_W/2} y={HOT_Y+30} textAnchor="middle"
                fill="#fca5a5" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="3">
                HOT  RESERVOIR
              </text>
              <text x={RES_X+RES_W/2} y={HOT_Y+52} textAnchor="middle"
                fill="white" fontSize="16" fontFamily="'JetBrains Mono',monospace" fontWeight="700">
                T_H = {T_H} K
              </text>
              <text x={RES_X+RES_W/2} y={HOT_Y+71} textAnchor="middle"
                fill="#fb923c" fontSize="10.5" fontFamily="monospace">
                Q_H = {fmt(Q_H)} J
              </text>
              <Flames active={isPlaying} speed={speed} />

              {/* ═══════════════════════════════════════════════════════════
                  COLD RESERVOIR
              ════════════════════════════════════════════════════════════ */}
              <rect x={RES_X} y={CLD_Y} width={RES_W} height={CLD_H} rx="14"
                fill="url(#eColdG)" filter="url(#eDrop)" />
              <rect x={RES_X+14} y={CLD_Y+10} width={RES_W-28} height="8" rx="4"
                fill="white" fillOpacity="0.05" />
              <rect x={RES_X} y={CLD_Y} width={RES_W} height={CLD_H} rx="14"
                fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.5" />

              <text x={RES_X+RES_W/2} y={CLD_Y+30} textAnchor="middle"
                fill="#93c5fd" fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="3">
                COLD  RESERVOIR
              </text>
              <text x={RES_X+RES_W/2} y={CLD_Y+52} textAnchor="middle"
                fill="white" fontSize="16" fontFamily="'JetBrains Mono',monospace" fontWeight="700">
                T_C = {T_C} K
              </text>
              <text x={RES_X+RES_W/2} y={CLD_Y+71} textAnchor="middle"
                fill="#60a5fa" fontSize="10.5" fontFamily="monospace">
                Q_C = {fmt(Q_C)} J
              </text>
              <Snowflakes active={isPlaying} />

              {/* ═══════════════════════════════════════════════════════════
                  Q_H  path  (hot → cylinder)
              ════════════════════════════════════════════════════════════ */}
              <motion.line
                x1={CY_MID} y1={HOT_Y+HOT_H}
                x2={CY_MID} y2={CY_TOP+2}
                stroke="#f97316" strokeWidth="2.5" strokeDasharray="8,5"
                strokeOpacity={qhActive ? 1 : 0.2}
                markerEnd="url(#eArrowH)"
                animate={{ strokeOpacity: qhActive ? 1 : 0.2 }}
                transition={{ duration: 0.3 }}
              />
              {/* label pill */}
              <rect x={CY_MID+7} y={HOT_Y+HOT_H+6} width="54" height="17" rx="5"
                fill="#431407" fillOpacity="0.85" />
              <text x={CY_MID+34} y={HOT_Y+HOT_H+18.5} textAnchor="middle"
                fill="#fb923c" fontSize="9.5" fontFamily="monospace" fontWeight="700">
                Q_H  in
              </text>
              <QHParticles active={qhActive} speed={speed} />

              {/* ═══════════════════════════════════════════════════════════
                  Q_C  path  (cylinder → cold)
              ════════════════════════════════════════════════════════════ */}
              <motion.line
                x1={CY_MID} y1={CY_BOT+2}
                x2={CY_MID} y2={CLD_Y-4}
                stroke="#60a5fa" strokeWidth="2.5" strokeDasharray="8,5"
                strokeOpacity={qcActive ? 1 : 0.2}
                markerEnd="url(#eArrowC)"
                animate={{ strokeOpacity: qcActive ? 1 : 0.2 }}
                transition={{ duration: 0.3 }}
              />
              <rect x={CY_MID+7} y={CY_BOT+8} width="55" height="17" rx="5"
                fill="#0c2854" fillOpacity="0.85" />
              <text x={CY_MID+34} y={CY_BOT+20.5} textAnchor="middle"
                fill="#7dd3fc" fontSize="9.5" fontFamily="monospace" fontWeight="700">
                Q_C  out
              </text>
              <QCParticles active={qcActive} speed={speed} />

              {/* ═══════════════════════════════════════════════════════════
                  CYLINDER  OUTER  WALLS
              ════════════════════════════════════════════════════════════ */}
              {/* outer casing with shadow */}
              <rect x={CX-22} y={CY_TOP-16} width={CW+44} height={CY_BOT-CY_TOP+32} rx="8"
                fill="url(#eWallG)" filter="url(#eDrop)" />
              {/* cylinder bore (interior dark) */}
              <rect x={CX} y={CY_TOP} width={CW} height={CY_BOT-CY_TOP} fill="#0f172a" />
              {/* bore edge highlight */}
              <rect x={CX} y={CY_TOP} width={2} height={CY_BOT-CY_TOP}
                fill="white" fillOpacity="0.06" />
              <rect x={CX+CW-2} y={CY_TOP} width={2} height={CY_BOT-CY_TOP}
                fill="white" fillOpacity="0.04" />

              {/* ── mist gas ── */}
              <GasMist pTop={pTop} gasRatio={gasRatio} isPlaying={isPlaying} speed={speed} />

              {/* gas temp label */}
              {CY_BOT - pBot > 40 && (
                <text x={CY_MID} y={(pBot + CY_BOT)/2 + 5} textAnchor="middle"
                  fill="rgba(255,255,255,0.55)" fontSize="11"
                  fontFamily="'JetBrains Mono',monospace" fontWeight="600">
                  T ≈ {gasT} K
                </text>
              )}

              {/* ── Efficiency gauge above cylinder ── */}
              <EtaGauge eta={eta} />

              {/* ── PISTON ROD (above piston, going up through head) ── */}
              <rect x={CY_MID-5} y={CY_TOP-16} width={10} height={pTop - CY_TOP + 16}
                fill="url(#eRodG)" rx="4" />
              {/* rod highlight */}
              <rect x={CY_MID-1.5} y={CY_TOP-14} width={3} height={pTop - CY_TOP + 12}
                fill="white" fillOpacity="0.2" rx="1.5" />

              {/* ── PISTON ── */}
              <rect x={CX+3} y={pTop} width={CW-6} height={PST_H} rx="3"
                fill="url(#ePistG)" />
              {/* piston top lip */}
              <rect x={CX+3} y={pTop} width={CW-6} height="5" rx="2"
                fill="#334155" />
              {/* piston ring 1 */}
              <rect x={CX+3} y={pTop+7} width={CW-6} height="3" rx="1.5"
                fill="none" stroke="#64748b" strokeWidth="1" />
              {/* piston ring 2 */}
              <rect x={CX+3} y={pTop+13} width={CW-6} height="3" rx="1.5"
                fill="none" stroke="#64748b" strokeWidth="1" />
              {/* highlight */}
              <rect x={CX+8} y={pTop+8} width={CW*0.28} height="2.5" rx="1"
                fill="white" fillOpacity="0.3" />

              {/* ── CONNECTING ROD (piston → crank pin) ── */}
              <line
                x1={CY_MID} y1={pTop + PST_H/2}
                x2={cpX}    y2={cpY}
                stroke="#1e293b" strokeWidth="9" strokeLinecap="round"
              />
              <line
                x1={CY_MID} y1={pTop + PST_H/2}
                x2={cpX}    y2={cpY}
                stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round"
              />
              {/* pin joints */}
              <circle cx={cpX}    cy={cpY}           r="7" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
              <circle cx={CY_MID} cy={pTop+PST_H/2}  r="5" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />

              {/* ── CRANKSHAFT ARM ── */}
              <line x1={CR_CX} y1={CR_CY} x2={cpX} y2={cpY}
                stroke="url(#eCrankG)" strokeWidth="12" strokeLinecap="round" />
              <line x1={CR_CX} y1={CR_CY} x2={cpX} y2={cpY}
                stroke="#64748b" strokeWidth="4" strokeLinecap="round" />

              {/* crank → flywheel axle */}
              <line x1={CR_CX} y1={CR_CY} x2={FW_CX} y2={FW_CY}
                stroke="#334155" strokeWidth="12" strokeLinecap="round" />
              <line x1={CR_CX} y1={CR_CY} x2={FW_CX} y2={FW_CY}
                stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />

              {/* main crank journal */}
              <circle cx={CR_CX} cy={CR_CY} r="14" fill="#0f172a" stroke="#475569" strokeWidth="3" />
              <circle cx={CR_CX} cy={CR_CY} r="6"  fill="#64748b" />

              {/* ── FLYWHEEL ── */}
              <Flywheel angle={angle} />

              {/* ── W_net output arrow ── */}
              <line
                x1={FW_CX+FW_R+4} y1={FW_CY}
                x2={FW_CX+FW_R+60} y2={FW_CY}
                stroke="#fbbf24" strokeWidth="4" markerEnd="url(#eArrowW)"
              />
              {/* label */}
              <rect x={FW_CX+FW_R+5} y={FW_CY-26} width="60" height="17" rx="5"
                fill="#1c1100" fillOpacity="0.9" />
              <text x={FW_CX+FW_R+35} y={FW_CY-14} textAnchor="middle"
                fill="#fbbf24" fontSize="9.5" fontFamily="monospace" fontWeight="700">
                W_net
              </text>
              <text x={FW_CX+FW_R+35} y={FW_CY+19} textAnchor="middle"
                fill="#fbbf24" fontSize="12" fontFamily="'JetBrains Mono',monospace" fontWeight="700">
                {fmt(W_net)} J
              </text>

              {/* ── cylinder bolt decorations ── */}
              {[CY_TOP+24, CY_TOP+70, CY_BOT-70, CY_BOT-24].map((y, i) => (
                <g key={i}>
                  <circle cx={CX-12} cy={y} r="4.5" fill="#374151" />
                  <circle cx={CX-12} cy={y} r="2.5" fill="#6b7280" />
                  <circle cx={CX-12} cy={y} r="1"   fill="#d1d5db" />
                  <circle cx={CX+CW+12} cy={y} r="4.5" fill="#374151" />
                  <circle cx={CX+CW+12} cy={y} r="2.5" fill="#6b7280" />
                  <circle cx={CX+CW+12} cy={y} r="1"   fill="#d1d5db" />
                </g>
              ))}

              {/* ── cylinder head cap ── */}
              <rect x={CX-22} y={CY_TOP-16} width={CW+44} height="10" rx="4"
                fill="#475569" />
              <rect x={CX-22} y={CY_BOT+6}  width={CW+44} height="10" rx="4"
                fill="#475569" />

              {/* ── process label (bottom-left corner) ── */}
              <rect x="8" y={SH-34} width="148" height="26" rx="6"
                fill="#1e293b" fillOpacity="0.9" />
              <text x="16" y={SH-18} fill="#94a3b8" fontSize="10" fontFamily="monospace">
                {expanding ? '① Expansion (Q_H in)' : '③ Compression (Q_C out)'}
              </text>
            </svg>
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button onClick={reset}
            className="w-9 h-9 rounded-full bg-white dark:bg-[#1e293b] shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all hover:scale-105 active:scale-95">
            <RotateCcw size={14} />
          </button>

          <motion.button
            onClick={() => setIsPlaying(!isPlaying)}
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl"
            style={{ background: isPlaying
              ? 'linear-gradient(135deg,#3b82f6,#4f46e5)'
              : 'linear-gradient(135deg,#f59e0b,#ea580c)' }}
          >
            {isPlaying ? <Pause size={22} /> : <Play size={22} />}
          </motion.button>

          <div className="flex items-center gap-2 bg-white dark:bg-[#1e293b] rounded-xl px-3 py-2 shadow-sm border border-gray-100 dark:border-gray-800">
            <Zap size={12} className="text-gray-400" />
            <span className="font-mono text-xs text-gray-400">Speed</span>
            <input type="range" min={0.25} max={4} step={0.25} value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
              className="w-24 sm:w-32 h-1.5 accent-amber-500 cursor-pointer" />
            <span className="font-mono text-xs text-amber-500 font-semibold w-8 text-right">
              {speed}×
            </span>
          </div>
        </div>

        {/* ── Value strip ── */}
        <div className="w-full max-w-2xl px-1 pb-4">
          <div className="grid grid-cols-5 gap-2">
            {[
              { label:'η',     value:`${(eta*100).toFixed(1)}%`, color:'#22c55e'  },
              { label:'Q_H',   value:`${fmt(Q_H)} J`,            color:'#f97316'  },
              { label:'Q_C',   value:`${fmt(Q_C)} J`,            color:'#60a5fa'  },
              { label:'W_net', value:`${fmt(W_net)} J`,          color:'#fbbf24'  },
              { label:'COP_R', value:COP_R.toFixed(3),           color:'#a78bfa'  },
            ].map(item => (
              <motion.div key={item.label}
                whileHover={{ y: -2, scale: 1.03 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="bg-white dark:bg-[#1e293b] rounded-xl border border-gray-100 dark:border-gray-800 p-2.5 sm:p-3 text-center shadow-sm cursor-default"
              >
                <p className="font-mono text-[10px] text-gray-400 mb-1 tracking-wide">{item.label}</p>
                <p className="font-mono text-xs sm:text-sm font-bold truncate" style={{ color: item.color }}>
                  {item.value}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
