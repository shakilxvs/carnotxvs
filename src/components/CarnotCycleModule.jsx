import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, ChevronLeft, ChevronRight, SlidersHorizontal, Moon, Sun } from 'lucide-react'
import BackButton from './BackButton'
import PVDiagram from './PVDiagram'
import { useApp } from '../context/AppContext'

const PROCESSES = [
  {
    label: '1 → 2',
    name: 'Isothermal Expansion',
    eq: 'PV = nRT_H = const',
    color: '#f97316',
    gasColor: '#fed7aa',
    pistonPct: 0.30,
    adiabatic: false,
    heat: 'hot',
  },
  {
    label: '2 → 3',
    name: 'Adiabatic Expansion',
    eq: 'PV^γ = const,  Q = 0',
    color: '#a855f7',
    gasColor: '#e9d5ff',
    pistonPct: 0.70,
    adiabatic: true,
    heat: 'none',
  },
  {
    label: '3 → 4',
    name: 'Isothermal Compression',
    eq: 'PV = nRT_C = const',
    color: '#3b82f6',
    gasColor: '#bfdbfe',
    pistonPct: 0.62,
    adiabatic: false,
    heat: 'cold',
  },
  {
    label: '4 → 1',
    name: 'Adiabatic Compression',
    eq: 'PV^γ = const,  Q = 0',
    color: '#22c55e',
    gasColor: '#bbf7d0',
    pistonPct: 0.18,
    adiabatic: true,
    heat: 'none',
  },
]

function StaticCylinder({ process }) {
  const CW = 70
  const CH = 148
  const OX = 16
  const OY = 12
  const PH = 11
  const pistonY = process.pistonPct * CH
  const gasTop = OY + pistonY + PH
  const gasH = Math.max(0, CH - pistonY - PH)
  const totalW = CW + OX * 2 + 4
  const totalH = CH + OY + 48
  const pid = `p${process.label.replace(/[^a-z0-9]/gi, '')}`

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
        <defs>
          {process.adiabatic && (
            <pattern id={pid} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="7" stroke="#a855f7" strokeWidth="1.5" strokeOpacity="0.5" />
            </pattern>
          )}
          <marker id={`arr${pid}`} markerWidth="5" markerHeight="5" refX="3" refY="2.5" orient="auto">
            <path d="M0,0 L5,2.5 L0,5 Z" fill={process.heat === 'hot' ? '#f97316' : '#3b82f6'} />
          </marker>
        </defs>

        {/* Walls */}
        <rect x="0" y={OY - 3} width={OX - 2} height={CH + 8} rx="2" fill="#94a3b8" />
        <rect x={OX + CW + 2} y={OY - 3} width={OX - 2} height={CH + 8} rx="2" fill="#94a3b8" />
        {/* Caps */}
        <rect x="0" y={OY - 6} width={totalW} height="8" rx="3" fill="#64748b" />
        <rect x="0" y={OY + CH} width={totalW} height="8" rx="3" fill="#64748b" />

        {/* Interior */}
        <rect x={OX} y={OY} width={CW} height={CH} fill="#f8fafc" />

        {/* Adiabatic hatch */}
        {process.adiabatic && (
          <>
            <rect x="0" y={OY - 3} width={OX - 2} height={CH + 8} fill={`url(#${pid})`} />
            <rect x={OX + CW + 2} y={OY - 3} width={OX - 2} height={CH + 8} fill={`url(#${pid})`} />
          </>
        )}

        {/* Gas fill */}
        {gasH > 0 && <rect x={OX} y={gasTop} width={CW} height={gasH} fill={process.gasColor} opacity="0.88" />}

        {/* Molecules */}
        {gasH > 14 &&
          [[0.18, 0.18], [0.55, 0.10], [0.82, 0.30], [0.28, 0.55], [0.72, 0.48], [0.14, 0.78], [0.60, 0.72], [0.88, 0.65]].map(([rx, ry], i) => (
            <circle key={i} cx={OX + rx * CW} cy={gasTop + ry * gasH} r="2" fill="white" opacity="0.65" />
          ))}

        {/* Piston */}
        <rect x={OX - 2} y={OY + pistonY} width={CW + 4} height={PH} rx="3" fill="#475569" stroke="#1e293b" strokeWidth="1.5" />

        {/* Piston rod */}
        <rect x={OX + CW / 2 - 3.5} y={OY} width="7" height={pistonY + 1} rx="2" fill="#64748b" />

        {/* SEALED badge */}
        {process.adiabatic && (
          <>
            <rect x={OX + CW / 2 - 20} y={OY + CH - 13} width="40" height="12" rx="6" fill="#7c3aed" />
            <text x={OX + CW / 2} y={OY + CH - 4} textAnchor="middle" fill="white" fontSize="6.5" fontFamily="system-ui,sans-serif" fontWeight="700">SEALED</text>
          </>
        )}

        {/* Heat arrows */}
        {process.heat === 'hot' && (
          <>
            <line x1={OX + CW / 2} y1={OY + CH + 34} x2={OX + CW / 2} y2={OY + CH + 12} stroke="#f97316" strokeWidth="2" strokeDasharray="3,2" markerEnd={`url(#arr${pid})`} />
            <text x={OX + CW / 2} y={OY + CH + 45} textAnchor="middle" fontSize="7.5" fill="#f97316" fontFamily="monospace">Q_H in</text>
          </>
        )}
        {process.heat === 'cold' && (
          <>
            <line x1={OX + CW / 2} y1={OY + CH + 12} x2={OX + CW / 2} y2={OY + CH + 34} stroke="#3b82f6" strokeWidth="2" strokeDasharray="3,2" markerEnd={`url(#arr${pid})`} />
            <text x={OX + CW / 2} y={OY + CH + 45} textAnchor="middle" fontSize="7.5" fill="#3b82f6" fontFamily="monospace">Q_C out</text>
          </>
        )}
        {process.heat === 'none' && (
          <text x={OX + CW / 2} y={OY + CH + 24} textAnchor="middle" fontSize="7" fill="#a855f7" fontFamily="monospace">no heat flow</text>
        )}
      </svg>

      <div className="text-center" style={{ width: 108 }}>
        <p className="font-mono text-[11px] font-bold" style={{ color: process.color }}>{process.label}</p>
        <p className="font-sans text-[10px] font-semibold text-gray-700 dark:text-gray-200 leading-tight mt-0.5">{process.name}</p>
        <p className="font-mono text-[8.5px] mt-0.5 break-words" style={{ color: process.color }}>{process.eq}</p>
      </div>
    </div>
  )
}

export default function CarnotCycleModule() {
  const { darkMode, setDarkMode } = useApp()
  const [processIdx, setProcessIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showSliders, setShowSliders] = useState(false)
  const [T_H, setTH] = useState(800)
  const [T_C, setTC] = useState(300)
  const [n, setN] = useState(1)
  const [V1, setV1] = useState(1)
  const [V2, setV2] = useState(4)
  const [gamma, setGamma] = useState(1.4)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => setProcessIdx(p => (p + 1) % 4), 2000 / speed)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [isPlaying, speed])

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      className="min-h-screen bg-[#fafafa] dark:bg-[#0f172a] transition-colors duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
        <BackButton />
        <div className="text-center">
          <h1 className="font-serif text-2xl font-bold text-gray-900 dark:text-white">Carnot Cycle</h1>
          <p className="font-sans text-xs text-gray-400 mt-0.5">Four reversible processes of an ideal heat engine</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSliders(!showSliders)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm font-sans transition-colors">
            <SlidersHorizontal size={15} /><span>Params</span>
          </button>
          <button onClick={() => setDarkMode(!darkMode)} className="w-8 h-8 rounded-full bg-white dark:bg-[#1e293b] shadow-sm flex items-center justify-center text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {/* Sliders */}
      <AnimatePresence>
        {showSliders && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1e293b]">
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'T_H (K)', value: T_H, set: setTH, min: 300, max: 1500, step: 10 },
                { label: 'T_C (K)', value: T_C, set: setTC, min: 50, max: 900, step: 10 },
                { label: 'n (mol)', value: n, set: setN, min: 0.1, max: 5, step: 0.1 },
                { label: 'V₁ (L)', value: V1, set: setV1, min: 0.1, max: 5, step: 0.1 },
                { label: 'V₂ (L)', value: V2, set: setV2, min: 0.5, max: 20, step: 0.5 },
              ].map(s => (
                <div key={s.label} className="space-y-1">
                  <div className="flex justify-between">
                    <label className="font-mono text-xs text-gray-500 dark:text-gray-400">{s.label}</label>
                    <span className="font-mono text-xs text-amber-600 dark:text-amber-400">{s.value}</span>
                  </div>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={e => s.set(parseFloat(e.target.value))} className="w-full h-1.5 rounded accent-amber-500" />
                </div>
              ))}
              <div className="space-y-1">
                <label className="font-mono text-xs text-gray-500 dark:text-gray-400">γ</label>
                <select value={gamma} onChange={e => setGamma(parseFloat(e.target.value))} className="w-full text-xs font-mono bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 text-gray-700 dark:text-gray-300">
                  <option value={1.667}>Monatomic (1.667)</option>
                  <option value={1.4}>Diatomic (1.4)</option>
                </select>
              </div>
            </div>
            {T_H <= T_C && <p className="px-6 pb-3 font-sans text-xs text-red-500">T_H must be greater than T_C</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* PV Diagram full width on top */}
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="font-serif text-base font-semibold text-gray-800 dark:text-white mb-0.5">P–V Diagram</h3>
          <p className="font-sans text-xs text-gray-400 mb-4">Active process highlighted — dot traces the cycle path</p>
          {T_H > T_C
            ? <PVDiagram processIdx={processIdx} n={n} T_H={T_H} T_C={T_C} V1={V1} V2={V2} gamma={gamma} />
            : <div className="h-48 flex items-center justify-center text-gray-400 font-sans text-sm">Set T_H greater than T_C to render the diagram</div>
          }
        </div>

        {/* 4 Cylinders simultaneously */}
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="font-serif text-base font-semibold text-gray-800 dark:text-white mb-0.5">Process States</h3>
          <p className="font-sans text-xs text-gray-400 mb-6">All four processes shown simultaneously — click any cylinder to select it</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 justify-items-center">
            {PROCESSES.map((proc, i) => (
              <motion.div
                key={i}
                onClick={() => { setProcessIdx(i); setIsPlaying(false) }}
                className="cursor-pointer rounded-xl p-3 w-full flex justify-center transition-all duration-200"
                style={{
                  opacity: processIdx === i ? 1 : 0.42,
                  border: `2px solid ${processIdx === i ? proc.color : 'transparent'}`,
                  background: processIdx === i ? `${proc.color}10` : 'transparent',
                  boxShadow: processIdx === i ? `0 0 16px ${proc.color}25` : 'none',
                }}
                whileHover={{ opacity: 1, scale: 1.02 }}
              >
                <StaticCylinder process={proc} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-4 pb-10 px-6">
        <div className="flex flex-wrap gap-2 justify-center">
          {PROCESSES.map((proc, i) => (
            <button
              key={i}
              onClick={() => { setProcessIdx(i); setIsPlaying(false) }}
              className="px-4 py-1.5 rounded-full text-xs font-mono font-semibold transition-all duration-200"
              style={{
                background: processIdx === i ? proc.color : 'transparent',
                color: processIdx === i ? 'white' : proc.color,
                border: `1.5px solid ${proc.color}`,
              }}
            >
              {proc.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setProcessIdx(p => (p + 3) % 4)} className="w-9 h-9 rounded-full bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button onClick={() => setProcessIdx(p => (p + 1) % 4)} className="w-9 h-9 rounded-full bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ChevronRight size={18} />
          </button>
          <div className="flex items-center gap-2 ml-2">
            <span className="font-mono text-xs text-gray-400">Speed</span>
            <input type="range" min={0.5} max={3} step={0.5} value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} className="w-20 h-1.5 accent-amber-500" />
            <span className="font-mono text-xs text-amber-600">{speed}×</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
