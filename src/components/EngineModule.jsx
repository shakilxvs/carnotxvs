import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, SlidersHorizontal, Moon, Sun, ChevronRight } from 'lucide-react'
import BackButton from './BackButton'
import { efficiency, heatAbsorbed, heatRejected, netWork, copR } from '../utils/carnotPhysics'
import { useApp } from '../context/AppContext'

// ─── SVG coordinate constants ─────────────────────────────────────────────────
const SW = 640, SH = 468

const RES_X = 172, RES_W = 270, RES_RX = 12
const HOT_Y = 6,  HOT_H = 70  // bottom = 76
const CLD_Y = 370, CLD_H = 70  // bottom = 440

const CX = 244, CW = 152        // cylinder left edge + width
const CY_MID = CX + CW / 2     // 320
const CY_TOP = 112, CY_BOT = 336
const PST_H  = 20

const CR_CX = 420, CR_CY = 224, CR_R = 60, ROD_LEN = 118
const FW_CX = 542, FW_CY = 224, FW_R   = 46

// ─── helpers ──────────────────────────────────────────────────────────────────
function pistonY(angle) {
  const cpX = CR_CX + CR_R * Math.cos(angle)
  const cpY = CR_CY + CR_R * Math.sin(angle)
  const dx  = CY_MID - cpX
  return cpY - Math.sqrt(Math.max(0, ROD_LEN * ROD_LEN - dx * dx))
}
const lerp  = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const fmt   = v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + 'M'
            : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(2) + 'k'
            : v.toFixed(1)

// ─── GAS MIST ─────────────────────────────────────────────────────────────────
function GasMist({ pBot, gasRatio, isPlaying, speed }) {
  const h = Math.max(0, CY_BOT - pBot)
  if (h < 2) return null
  const r = Math.round(lerp(59,  220, gasRatio))
  const g = Math.round(lerp(130, 60,  gasRatio))
  const b = Math.round(lerp(246, 60,  gasRatio))
  const col = (a) => `rgba(${r},${g},${b},${a})`
  return (
    <g>
      <defs>
        <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={col(0.55)} />
          <stop offset="40%"  stopColor={col(0.25)} />
          <stop offset="100%" stopColor={col(0.10)} />
        </linearGradient>
      </defs>
      <rect x={CX+2} y={pBot} width={CW-4} height={h} fill="url(#gasGrad)" />
      {[0, 1, 2].map(i => {
        const bY  = pBot + h * (0.2 + i * 0.28)
        const bRY = h * 0.14
        return (
          <motion.ellipse key={i}
            cx={CY_MID + (i === 1 ? -18 : i === 2 ? 20 : 0)}
            cy={bY} rx={CW * 0.35} ry={bRY}
            fill={col(0.13)}
            animate={isPlaying ? {
              cx: [CY_MID+(i===1?-18:i===2?20:0), CY_MID+(i===1?16:i===2?-16:0), CY_MID+(i===1?-18:i===2?20:0)],
              ry: [bRY, bRY*1.4, bRY],
              opacity: [0.13, 0.22, 0.13],
            } : { opacity: 0.1 }}
            transition={{ duration: (1.2 + i * 0.35) / (speed || 1), repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
          />
        )
      })}
      <rect x={CX+2} y={pBot} width={CW-4} height={2.5} fill={col(0.65)} />
    </g>
  )
}

// ─── FLAMES inside hot reservoir ──────────────────────────────────────────────
function Flames({ active, speed }) {
  if (!active) return null
  return (
    <>
      {[0.15, 0.3, 0.5, 0.65, 0.82].map((frac, i) => {
        const x   = RES_X + frac * RES_W
        const dur = (0.45 + (i % 3) * 0.18) / speed
        return (
          <motion.ellipse key={i}
            cx={x} cy={HOT_Y + HOT_H - 10}
            rx={3 + (i % 2)} ry={5 + (i % 3) * 3}
            fill={i % 2 === 0 ? '#f97316' : '#fbbf24'} fillOpacity={0.7}
            animate={{
              cy:     [HOT_Y+HOT_H-10, HOT_Y+HOT_H-26, HOT_Y+HOT_H-10],
              ry:     [5+(i%3)*3, (5+(i%3)*3)*1.7, 5+(i%3)*3],
              opacity:[0.75, 0.35, 0.75],
            }}
            transition={{ duration: dur, repeat: Infinity, delay: i * 0.09, ease: 'easeInOut' }}
          />
        )
      })}
    </>
  )
}

// ─── SNOWFLAKES inside cold reservoir ─────────────────────────────────────────
function Snowflakes() {
  return (
    <>
      {[0.15, 0.35, 0.55, 0.75, 0.88].map((frac, i) => {
        const x  = RES_X + frac * RES_W
        const cy = CLD_Y + CLD_H / 2
        return (
          <motion.g key={i}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 6 + i * 0.8, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: `${x}px ${cy}px` }}
          >
            {[0, 60, 120].map(a => {
              const rad = a * Math.PI / 180
              return <line key={a}
                x1={x - 7*Math.cos(rad)} y1={cy - 7*Math.sin(rad)}
                x2={x + 7*Math.cos(rad)} y2={cy + 7*Math.sin(rad)}
                stroke="#93c5fd" strokeWidth="1.5" strokeOpacity="0.6" />
            })}
          </motion.g>
        )
      })}
    </>
  )
}

// ─── HEAT PARTICLES ───────────────────────────────────────────────────────────
function QHParticles({ active, speed }) {
  if (!active) return null
  return (
    <>
      {[0, 1, 2].map(i => (
        <motion.circle key={i} r={3.5}
          fill={i % 2 === 0 ? '#f97316' : '#fbbf24'}
          animate={{
            cx:      [CY_MID + (i===0?-12:i===1?12:0), CY_MID + (i===0?-4:i===1?4:0)],
            cy:      [HOT_Y + HOT_H + 2, CY_TOP + 14],
            opacity: [0, 0.9, 0.9, 0],
          }}
          transition={{ duration: 0.75/speed, repeat: Infinity, delay: i*0.25, ease: 'easeIn' }}
        />
      ))}
    </>
  )
}

function QCParticles({ active, speed }) {
  if (!active) return null
  return (
    <>
      {[0, 1, 2].map(i => (
        <motion.circle key={i} r={3.5}
          fill={i % 2 === 0 ? '#60a5fa' : '#93c5fd'}
          animate={{
            cx:      [CY_MID + (i===0?-10:i===1?10:0), CY_MID + (i===0?-20:i===1?20:0)],
            cy:      [CY_BOT - 10, CLD_Y - 2],
            opacity: [0, 0.9, 0.9, 0],
          }}
          transition={{ duration: 0.75/speed, repeat: Infinity, delay: i*0.25, ease: 'easeOut' }}
        />
      ))}
    </>
  )
}

// ─── FLYWHEEL ─────────────────────────────────────────────────────────────────
function Flywheel({ angle }) {
  return (
    <g>
      <circle cx={FW_CX+1} cy={FW_CY+2} r={FW_R} fill="rgba(0,0,0,0.18)" />
      <circle cx={FW_CX}   cy={FW_CY}   r={FW_R} fill="none" stroke="#78350f" strokeWidth="8" />
      <circle cx={FW_CX}   cy={FW_CY}   r={FW_R} fill="none" stroke="#f59e0b" strokeWidth="3" />
      <circle cx={FW_CX}   cy={FW_CY}   r={FW_R-11} fill="none" stroke="#d97706" strokeWidth="1" strokeOpacity="0.3" />
      {Array.from({length:8}, (_,i) => {
        const a = angle + i * Math.PI / 4
        return <line key={i}
          x1={FW_CX + 8*Math.cos(a)} y1={FW_CY + 8*Math.sin(a)}
          x2={FW_CX + (FW_R-6)*Math.cos(a)} y2={FW_CY + (FW_R-6)*Math.sin(a)}
          stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
      })}
      <circle cx={FW_CX} cy={FW_CY} r={10} fill="#1c1917" stroke="#d97706" strokeWidth="2.5" />
      <circle cx={FW_CX} cy={FW_CY} r={4}  fill="#fbbf24" />
    </g>
  )
}

// ─── PROCESS INFO ─────────────────────────────────────────────────────────────
const PROCESS_INFO = [
  { label:'1→2', name:'Isothermal Expansion',   color:'#ef4444',
    desc:'Gas absorbs heat Q_H from the hot reservoir at constant temperature T_H. The piston moves down, doing positive work.', eq:'W = nRT_H ln(V₂/V₁)' },
  { label:'2→3', name:'Adiabatic Expansion',    color:'#a855f7',
    desc:'Cylinder is insulated — no heat exchange. Gas continues expanding; temperature falls from T_H down to T_C.', eq:'TV^(γ−1) = const' },
  { label:'3→4', name:'Isothermal Compression', color:'#3b82f6',
    desc:'Gas rejects heat Q_C to the cold reservoir at constant temperature T_C. The piston moves up.', eq:'W = nRT_C ln(V₄/V₃)' },
  { label:'4→1', name:'Adiabatic Compression',  color:'#22c55e',
    desc:'Cylinder is insulated again. Gas is compressed back to its initial state; temperature rises from T_C to T_H.', eq:'PV^γ = const' },
]

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function EngineModule() {
  const { darkMode, setDarkMode } = useApp()
  const [T_H, setTH] = useState(800)
  const [T_C, setTC] = useState(300)
  const [n,   setN]  = useState(1)
  const [V1,  setV1] = useState(1)
  const [V2,  setV2] = useState(4)
  const [isPlaying,   setIsPlaying]   = useState(false)
  const [speed,       setSpeed]       = useState(1)
  const [showSliders, setShowSliders] = useState(false)
  const [angle,       setAngle]       = useState(-Math.PI / 2)
  const [activeStep,  setActiveStep]  = useState(0)

  const rafRef  = useRef(null)
  const lastRef = useRef(null)

  useEffect(() => {
    if (!isPlaying) { cancelAnimationFrame(rafRef.current); lastRef.current = null; return }
    const radsPerMs = (speed * 60 * 2 * Math.PI) / 60000
    const tick = ts => {
      if (lastRef.current != null) {
        setAngle(a => {
          const next = a + radsPerMs * (ts - lastRef.current)
          const norm = ((next % (Math.PI*2)) + Math.PI*2) % (Math.PI*2)
          setActiveStep(norm < Math.PI/2 ? 0 : norm < Math.PI ? 1 : norm < 3*Math.PI/2 ? 2 : 3)
          return next
        })
      }
      lastRef.current = ts
      rafRef.current  = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(rafRef.current); lastRef.current = null }
  }, [isPlaying, speed])

  const reset = () => { setIsPlaying(false); setAngle(-Math.PI/2); setActiveStep(0) }
  const step  = () => {
    const next = (activeStep + 1) % 4
    setActiveStep(next)
    setAngle(-Math.PI/2 + next * Math.PI/2)
  }

  const eta   = T_H > T_C ? efficiency(T_H, T_C) : 0
  const Q_H   = heatAbsorbed(n, T_H, V1, V2)
  const Q_C   = Math.abs(heatRejected(n, T_C, V2*Math.pow(T_H/T_C,2.5), V1*Math.pow(T_H/T_C,2.5)))
  const W_net = netWork(Q_H, Q_C)
  const COP_R = T_H > T_C ? copR(T_H, T_C) : 0

  const rawPY    = pistonY(angle)
  const pTop     = clamp(rawPY, CY_TOP, CY_BOT - PST_H - 2)
  const pBot     = pTop + PST_H
  const cpX      = CR_CX + CR_R * Math.cos(angle)
  const cpY      = CR_CY + CR_R * Math.sin(angle)
  const gasRatio = clamp(1 - (pTop - CY_TOP) / (CY_BOT - CY_TOP - PST_H), 0, 1)
  const gasT     = Math.round(lerp(T_C, T_H, gasRatio))
  const norm     = ((angle % (Math.PI*2)) + Math.PI*2) % (Math.PI*2)
  const expanding = norm < Math.PI
  const qhActive  = isPlaying && expanding
  const qcActive  = isPlaying && !expanding
  const info      = PROCESS_INFO[activeStep]

  return (
    <motion.div
      initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-16 }}
      transition={{ type:'spring', stiffness:160, damping:22 }}
      className="min-h-screen bg-[#f8fafc] dark:bg-[#0a0f1e] flex flex-col"
    >
      {/* Header */}
      <div className="bg-white dark:bg-[#0f172a] border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <BackButton />
        <div className="text-center">
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Carnot Engine</h1>
          <p className="text-xs text-gray-400 mt-0.5 tracking-wide">Engine schematic · live simulation</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSliders(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
              ${showSliders
                ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400'
                : 'bg-white dark:bg-[#1e293b] border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
            <SlidersHorizontal size={13}/><span className="hidden sm:inline">Params</span>
          </button>
          <button onClick={() => setDarkMode(d => !d)}
            className="w-8 h-8 rounded-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
            {darkMode ? <Sun size={14}/> : <Moon size={14}/>}
          </button>
        </div>
      </div>

      {/* Param panel */}
      <AnimatePresence>
        {showSliders && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
            className="overflow-hidden bg-white dark:bg-[#1e293b] border-b border-gray-100 dark:border-gray-800">
            <div className="px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
              {[
                { label:'T_H', unit:'K',   val:T_H, set:setTH, min:301, max:1500, step:10  },
                { label:'T_C', unit:'K',   val:T_C, set:setTC, min:50,  max:899,  step:10  },
                { label:'n',   unit:'mol', val:n,   set:setN,  min:0.1, max:5,    step:0.1 },
                { label:'V₁',  unit:'L',   val:V1,  set:setV1, min:0.1, max:5,    step:0.1 },
                { label:'V₂',  unit:'L',   val:V2,  set:setV2, min:0.5, max:20,   step:0.5 },
              ].map(s => (
                <div key={s.label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="font-mono text-xs text-gray-500">{s.label} <span className="text-gray-400">({s.unit})</span></span>
                    <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-semibold">{s.val}</span>
                  </div>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={s.val}
                    onChange={e => s.set(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full accent-amber-500 cursor-pointer" />
                </div>
              ))}
            </div>
            {T_H <= T_C && <p className="px-6 pb-3 text-xs text-red-500 font-medium">T_H must exceed T_C</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col items-center px-3 sm:px-6 py-5 gap-4 max-w-3xl mx-auto w-full">

        {/* Process pills */}
        <div className="flex gap-2 self-start flex-wrap">
          {PROCESS_INFO.map((p, i) => (
            <button key={i}
              onClick={() => { setActiveStep(i); setAngle(-Math.PI/2 + i * Math.PI/2); setIsPlaying(false) }}
              className="px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all"
              style={activeStep === i
                ? { background: p.color, color: '#fff', borderColor: p.color, boxShadow: `0 2px 12px ${p.color}55` }
                : { background: 'transparent', color: '#9ca3af', borderColor: '#d1d5db' }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Engine SVG */}
        <div className="w-full bg-[#111827] rounded-2xl shadow-xl overflow-hidden border border-gray-800/50">
          <svg viewBox={`0 0 ${SW} ${SH}`} width="100%" style={{ display:'block' }}>
            <defs>
              <linearGradient id="hotRes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7f1d1d"/><stop offset="100%" stopColor="#b91c1c"/>
              </linearGradient>
              <linearGradient id="coldRes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e3a8a"/><stop offset="100%" stopColor="#1e40af"/>
              </linearGradient>
              <linearGradient id="wallLR" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#1e293b"/>
                <stop offset="14%"  stopColor="#475569"/>
                <stop offset="50%"  stopColor="#94a3b8"/>
                <stop offset="86%"  stopColor="#475569"/>
                <stop offset="100%" stopColor="#1e293b"/>
              </linearGradient>
              <linearGradient id="pistG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#e2e8f0"/>
                <stop offset="55%"  stopColor="#64748b"/>
                <stop offset="100%" stopColor="#334155"/>
              </linearGradient>
              <linearGradient id="rodG" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#0f172a"/>
                <stop offset="50%"  stopColor="#64748b"/>
                <stop offset="100%" stopColor="#0f172a"/>
              </linearGradient>
              <marker id="arrowR" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="#f97316"/>
              </marker>
              <marker id="arrowB" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="#60a5fa"/>
              </marker>
              <marker id="arrowY" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#fbbf24"/>
              </marker>
            </defs>

            {/* dot grid */}
            {Array.from({length:20},(_,r) => Array.from({length:33},(_,c) => (
              <circle key={`${r}-${c}`} cx={c*20+10} cy={r*24+12} r="0.65" fill="#1e293b"/>
            )))}

            {/* HOT RESERVOIR */}
            <rect x={RES_X} y={HOT_Y} width={RES_W} height={HOT_H} rx={RES_RX} fill="url(#hotRes)"/>
            <rect x={RES_X} y={HOT_Y} width={RES_W} height={HOT_H} rx={RES_RX} fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.45"/>
            <rect x={RES_X+14} y={HOT_Y+8} width={RES_W-28} height="7" rx="3.5" fill="white" fillOpacity="0.06"/>
            <text x={RES_X+RES_W/2} y={HOT_Y+24} textAnchor="middle" fill="#fca5a5" fontSize="9.5" fontFamily="monospace" fontWeight="700" letterSpacing="3">HOT RESERVOIR</text>
            <text x={RES_X+RES_W/2} y={HOT_Y+44} textAnchor="middle" fill="white" fontSize="14" fontFamily="monospace" fontWeight="700">T_H = {T_H} K</text>
            <text x={RES_X+RES_W/2} y={HOT_Y+62} textAnchor="middle" fill="#fb923c" fontSize="10" fontFamily="monospace">Q_H = {fmt(Q_H)} J</text>
            <Flames active={isPlaying} speed={speed}/>

            {/* Q_H ARROW */}
            <line x1={CY_MID} y1={HOT_Y+HOT_H} x2={CY_MID} y2={CY_TOP-2}
              stroke="#f97316" strokeWidth="2" strokeDasharray="6,4"
              strokeOpacity={qhActive ? 0.9 : 0.2} markerEnd="url(#arrowR)"/>
            <rect x={CY_MID+5} y={HOT_Y+HOT_H+5} width="48" height="15" rx="4" fill="#431407" fillOpacity="0.9"/>
            <text x={CY_MID+29} y={HOT_Y+HOT_H+16} textAnchor="middle" fill="#fb923c" fontSize="9" fontFamily="monospace" fontWeight="700">Q_H in</text>
            <QHParticles active={qhActive} speed={speed}/>

            {/* CYLINDER OUTER CASING */}
            <rect x={CX-18} y={CY_TOP-12} width={CW+36} height={CY_BOT-CY_TOP+24} rx="7" fill="url(#wallLR)"/>
            {/* bore */}
            <rect x={CX} y={CY_TOP} width={CW} height={CY_BOT-CY_TOP} fill="#0f172a" rx="1"/>
            <rect x={CX}     y={CY_TOP} width={2} height={CY_BOT-CY_TOP} fill="white" fillOpacity="0.05"/>
            <rect x={CX+CW-2} y={CY_TOP} width={2} height={CY_BOT-CY_TOP} fill="white" fillOpacity="0.03"/>

            {/* GAS MIST */}
            <GasMist pBot={pBot} gasRatio={gasRatio} isPlaying={isPlaying} speed={speed}/>

            {/* gas temp */}
            {CY_BOT - pBot > 36 && (
              <text x={CY_MID} y={(pBot+CY_BOT)/2+5} textAnchor="middle"
                fill="rgba(255,255,255,0.45)" fontSize="11" fontFamily="monospace" fontWeight="600">
                T ≈ {gasT} K
              </text>
            )}

            {/* head + base caps */}
            <rect x={CX-18} y={CY_TOP-12} width={CW+36} height="9" rx="3" fill="#374151"/>
            <rect x={CX-18} y={CY_BOT+3}  width={CW+36} height="9" rx="3" fill="#374151"/>

            {/* bolts */}
            {[CY_TOP+20, CY_TOP+58, CY_BOT-58, CY_BOT-20].map((y,i) => (
              <g key={i}>
                {[CX-11, CX+CW+11].map(bx => (
                  <g key={bx}>
                    <circle cx={bx} cy={y} r="4"   fill="#1e293b"/>
                    <circle cx={bx} cy={y} r="2.5" fill="#4b5563"/>
                    <circle cx={bx} cy={y} r="1"   fill="#9ca3af"/>
                  </g>
                ))}
              </g>
            ))}

            {/* PISTON ROD */}
            <rect x={CY_MID-4} y={CY_TOP-12} width={8} height={Math.max(1, pTop-CY_TOP+12)} fill="url(#rodG)" rx="3"/>
            <rect x={CY_MID-1} y={CY_TOP-10} width={2} height={Math.max(1, pTop-CY_TOP+8)} fill="white" fillOpacity="0.2" rx="1"/>

            {/* PISTON */}
            <rect x={CX+3} y={pTop} width={CW-6} height={PST_H} rx="3" fill="url(#pistG)"/>
            <rect x={CX+3} y={pTop} width={CW-6} height={4} rx="2" fill="#334155"/>
            <rect x={CX+3} y={pTop+7}  width={CW-6} height={2.5} rx="1" fill="none" stroke="#4b5563" strokeWidth="0.8"/>
            <rect x={CX+3} y={pTop+13} width={CW-6} height={2.5} rx="1" fill="none" stroke="#4b5563" strokeWidth="0.8"/>
            <rect x={CX+8} y={pTop+8}  width={40}   height={2}   rx="1" fill="white" fillOpacity="0.25"/>

            {/* CONNECTING ROD */}
            <line x1={CY_MID} y1={pTop+PST_H/2} x2={cpX} y2={cpY} stroke="#0f172a" strokeWidth="8" strokeLinecap="round"/>
            <line x1={CY_MID} y1={pTop+PST_H/2} x2={cpX} y2={cpY} stroke="#64748b" strokeWidth="3" strokeLinecap="round"/>
            <circle cx={cpX}    cy={cpY}          r="6"   fill="#0f172a" stroke="#64748b" strokeWidth="2"/>
            <circle cx={CY_MID} cy={pTop+PST_H/2} r="4.5" fill="#0f172a" stroke="#64748b" strokeWidth="2"/>

            {/* CRANK ARM */}
            <line x1={CR_CX} y1={CR_CY} x2={cpX}   y2={cpY}   stroke="#1e293b" strokeWidth="11" strokeLinecap="round"/>
            <line x1={CR_CX} y1={CR_CY} x2={cpX}   y2={cpY}   stroke="#4b5563" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1={CR_CX} y1={CR_CY} x2={FW_CX} y2={FW_CY} stroke="#1e293b" strokeWidth="11" strokeLinecap="round"/>
            <line x1={CR_CX} y1={CR_CY} x2={FW_CX} y2={FW_CY} stroke="#4b5563" strokeWidth="3.5" strokeLinecap="round"/>
            <circle cx={CR_CX} cy={CR_CY} r="12" fill="#0f172a" stroke="#4b5563" strokeWidth="2.5"/>
            <circle cx={CR_CX} cy={CR_CY} r="5"  fill="#64748b"/>

            {/* FLYWHEEL */}
            <Flywheel angle={angle}/>

            {/* W_net arrow */}
            <line x1={FW_CX+FW_R+3} y1={FW_CY} x2={FW_CX+FW_R+58} y2={FW_CY}
              stroke="#fbbf24" strokeWidth="3.5" markerEnd="url(#arrowY)"/>
            <rect x={FW_CX+FW_R+4} y={FW_CY-22} width="52" height="15" rx="4" fill="#1c1100" fillOpacity="0.9"/>
            <text x={FW_CX+FW_R+30} y={FW_CY-11} textAnchor="middle" fill="#fbbf24" fontSize="9" fontFamily="monospace" fontWeight="700">W_net</text>
            <text x={FW_CX+FW_R+30} y={FW_CY+18} textAnchor="middle" fill="#fbbf24" fontSize="12" fontFamily="monospace" fontWeight="700">{fmt(W_net)} J</text>

            {/* Q_C ARROW */}
            <line x1={CY_MID} y1={CY_BOT+9} x2={CY_MID} y2={CLD_Y-2}
              stroke="#60a5fa" strokeWidth="2" strokeDasharray="6,4"
              strokeOpacity={qcActive ? 0.9 : 0.2} markerEnd="url(#arrowB)"/>
            <rect x={CY_MID+5} y={CY_BOT+12} width="52" height="15" rx="4" fill="#0c2254" fillOpacity="0.9"/>
            <text x={CY_MID+31} y={CY_BOT+23} textAnchor="middle" fill="#7dd3fc" fontSize="9" fontFamily="monospace" fontWeight="700">Q_C out</text>
            <QCParticles active={qcActive} speed={speed}/>

            {/* COLD RESERVOIR */}
            <rect x={RES_X} y={CLD_Y} width={RES_W} height={CLD_H} rx={RES_RX} fill="url(#coldRes)"/>
            <rect x={RES_X} y={CLD_Y} width={RES_W} height={CLD_H} rx={RES_RX} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.4"/>
            <rect x={RES_X+14} y={CLD_Y+8} width={RES_W-28} height="7" rx="3.5" fill="white" fillOpacity="0.05"/>
            <text x={RES_X+RES_W/2} y={CLD_Y+24} textAnchor="middle" fill="#93c5fd" fontSize="9.5" fontFamily="monospace" fontWeight="700" letterSpacing="3">COLD RESERVOIR</text>
            <text x={RES_X+RES_W/2} y={CLD_Y+44} textAnchor="middle" fill="white" fontSize="14" fontFamily="monospace" fontWeight="700">T_C = {T_C} K</text>
            <text x={RES_X+RES_W/2} y={CLD_Y+62} textAnchor="middle" fill="#60a5fa" fontSize="10" fontFamily="monospace">Q_C = {fmt(Q_C)} J</text>
            <Snowflakes/>
          </svg>
        </div>

        {/* Process description */}
        <AnimatePresence mode="wait">
          <motion.div key={activeStep}
            initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
            transition={{ duration:0.2 }}
            className="w-full bg-white dark:bg-[#1e293b] rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: info.color }}/>
              <h3 className="font-serif text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                Process {info.label} — {info.name}
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">{info.desc}</p>
            <code className="text-xs font-mono text-gray-500 dark:text-gray-500 bg-gray-50 dark:bg-[#0f172a] px-2.5 py-1 rounded-md">
              {info.eq}
            </code>
          </motion.div>
        </AnimatePresence>

        {/* Controls */}
        <div className="flex items-center justify-between w-full gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={() => { setIsPlaying(false); step() }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-50 transition-all shadow-sm">
              <ChevronRight size={15}/>Step
            </button>
            <button onClick={reset}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-50 transition-all shadow-sm">
              <RotateCcw size={14}/>Reset
            </button>
          </div>

          <motion.button onClick={() => setIsPlaying(p => !p)}
            whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-sm font-semibold shadow-lg"
            style={{ background: isPlaying ? '#4f46e5' : '#f59e0b' }}
          >
            {isPlaying ? <><Pause size={16}/>Pause</> : <><Play size={16}/>Play</>}
          </motion.button>

          <div className="flex items-center gap-2 bg-white dark:bg-[#1e293b] rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-700 shadow-sm">
            <span className="font-mono text-xs text-gray-400">Speed</span>
            <input type="range" min={0.25} max={4} step={0.25} value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
              className="w-24 h-1.5 accent-amber-500 cursor-pointer"/>
            <span className="font-mono text-xs text-amber-500 font-bold w-7">{speed}×</span>
          </div>
        </div>

        {/* Value chips */}
        <div className="grid grid-cols-5 gap-2 w-full pb-4">
          {[
            { label:'η',     val:`${(eta*100).toFixed(1)}%`, color:'#22c55e' },
            { label:'Q_H',   val:`${fmt(Q_H)} J`,            color:'#f97316' },
            { label:'Q_C',   val:`${fmt(Q_C)} J`,            color:'#60a5fa' },
            { label:'W_net', val:`${fmt(W_net)} J`,          color:'#fbbf24' },
            { label:'COP_R', val:COP_R.toFixed(3),           color:'#a78bfa' },
          ].map(c => (
            <motion.div key={c.label} whileHover={{ y:-2 }} transition={{ type:'spring', stiffness:400 }}
              className="bg-white dark:bg-[#1e293b] rounded-xl border border-gray-100 dark:border-gray-800 py-3 text-center shadow-sm cursor-default">
              <p className="font-mono text-[10px] text-gray-400 mb-1 tracking-wide">{c.label}</p>
              <p className="font-mono text-xs sm:text-sm font-bold" style={{ color: c.color }}>{c.val}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
