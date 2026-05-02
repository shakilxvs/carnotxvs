import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, ChevronLeft, ChevronRight, SlidersHorizontal, Moon, Sun } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceDot,
} from 'recharts'
import BackButton from './BackButton'
import { useApp } from '../context/AppContext'
import { allStates, isothermPoints, adiabaticPoints } from '../utils/carnotPhysics'

const PROCESS_LABELS = ['1 → 2', '2 → 3', '3 → 4', '4 → 1']
const PROCESS_COLORS = ['#f97316', '#a855f7', '#3b82f6', '#22c55e']
const PROCESS_NAMES  = ['Isothermal Expansion', 'Adiabatic Expansion', 'Isothermal Compression', 'Adiabatic Compression']
const PROCESS_EQS    = ['PV = nRT_H', 'PV^γ = const', 'PV = nRT_C', 'PV^γ = const']
const PROCESS_GAS    = ['#fed7aa', '#ddd6fe', '#bfdbfe', '#bbf7d0']

// Piston fractional position (0=top, 1=bottom) representing the start of each process
// 1→2: piston near top (small V1)   2→3: piston mid   3→4: piston near bottom (large V3)   4→1: mid-high
const PISTON_FRACS = [0.15, 0.48, 0.80, 0.48]

// ── Mini cylinder SVG ──────────────────────────────────────────────
function MiniCylinder({ active, color, gasColor, pistonFrac }) {
  const W = 84, H = 140, WALL = 10
  const pistonY = 14 + pistonFrac * (H - 30)
  const gasH    = Math.max(0, H - 14 - pistonY)

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Cylinder walls */}
      <rect x={0}      y={0} width={WALL} height={H} rx={3} fill="#94a3b8" />
      <rect x={W-WALL} y={0} width={WALL} height={H} rx={3} fill="#94a3b8" />
      {/* Top rim */}
      <rect x={0} y={0} width={W} height={14} rx={4} fill="#94a3b8" />
      {/* Interior */}
      <rect x={WALL} y={14} width={W - WALL*2} height={H - 14} fill="#f1f5f9" />
      {/* Gas fill */}
      <rect x={WALL+1} y={pistonY+12} width={W - WALL*2 - 2} height={Math.max(0, gasH - 6)} fill={gasColor} opacity={0.88} />
      {/* Bottom cap */}
      <rect x={0} y={H-10} width={W} height={10} rx={3} fill="#94a3b8" />
      {/* Piston */}
      <rect x={WALL-3} y={pistonY} width={W-WALL*2+6} height={14} rx={3} fill="#475569" />
      {/* Piston rod */}
      <rect x={W/2-5} y={Math.max(2, pistonY-20)} width={10} height={22} rx={2} fill="#64748b" />
    </svg>
  )
}

// ── Full-width PV diagram ──────────────────────────────────────────
function FullPVDiagram({ processIdx, dotProgress, n, T_H, T_C, V1, V2, gamma }) {
  const states = useMemo(() => {
    try { return allStates(n, T_H, T_C, V1, V2, gamma) }
    catch { return null }
  }, [n, T_H, T_C, V1, V2, gamma])

  const curves = useMemo(() => {
    if (!states) return null
    const { s2, s3, s4 } = states
    return {
      p12: isothermPoints(n, T_H, V1, V2),
      p23: adiabaticPoints(s2.P / 1000, V2, gamma, s3.V),
      p34: isothermPoints(n, T_C, s3.V, s4.V),
      p41: adiabaticPoints(s4.P / 1000, s4.V, gamma, V1),
    }
  }, [states, n, T_H, T_C, V1, V2, gamma])

  if (!states || !curves) return (
    <div className="flex items-center justify-center h-56 text-gray-400 font-sans text-sm">
      T_H must be greater than T_C
    </div>
  )

  const { s1, s2, s3, s4 } = states
  const allPts = [...curves.p12, ...curves.p23, ...curves.p34, ...curves.p41]
  const maxP   = Math.max(...allPts.map(p => p.P)) * 1.12
  const maxV   = Math.max(...allPts.map(p => p.V)) * 1.08
  const minV   = Math.min(...allPts.map(p => p.V)) * 0.92

  const curvesArr = [curves.p12, curves.p23, curves.p34, curves.p41]
  const cur    = curvesArr[processIdx]
  const dotIdx = Math.min(Math.floor(dotProgress * (cur.length - 1)), cur.length - 1)
  const dotPt  = cur[dotIdx]

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={270}>
        <LineChart margin={{ top: 8, right: 28, left: 8, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
          <XAxis dataKey="V" type="number" domain={[minV, maxV]}
            label={{ value: 'Volume (L)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94a3b8', fontFamily: 'DM Sans' }}
            tickFormatter={v => v.toFixed(1)} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDataOverflow />
          <YAxis dataKey="P" type="number" domain={[0, maxP]}
            label={{ value: 'P (kPa)', angle: -90, position: 'insideLeft', offset: 14, fontSize: 11, fill: '#94a3b8', fontFamily: 'DM Sans' }}
            tickFormatter={v => v.toFixed(0)} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDataOverflow />
          <Tooltip contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={v => v.toFixed(2)} />

          <Line data={curves.p12} dataKey="P" dot={false} stroke="#f97316" strokeWidth={processIdx===0?3:1.5} strokeOpacity={processIdx===0?1:0.35} name="1→2" isAnimationActive={false} />
          <Line data={curves.p23} dataKey="P" dot={false} stroke="#a855f7" strokeWidth={processIdx===1?3:1.5} strokeOpacity={processIdx===1?1:0.35} name="2→3" isAnimationActive={false} />
          <Line data={curves.p34} dataKey="P" dot={false} stroke="#3b82f6" strokeWidth={processIdx===2?3:1.5} strokeOpacity={processIdx===2?1:0.35} name="3→4" isAnimationActive={false} />
          <Line data={curves.p41} dataKey="P" dot={false} stroke="#22c55e" strokeWidth={processIdx===3?3:1.5} strokeOpacity={processIdx===3?1:0.35} name="4→1" isAnimationActive={false} />

          <ReferenceDot x={s1.V} y={s1.P/1000} r={5} fill="#111827" stroke="white" strokeWidth={2} label={{ value:'1', position:'top',    fill:'#111827', fontSize:11, fontFamily:'JetBrains Mono' }} />
          <ReferenceDot x={s2.V} y={s2.P/1000} r={5} fill="#111827" stroke="white" strokeWidth={2} label={{ value:'2', position:'top',    fill:'#111827', fontSize:11, fontFamily:'JetBrains Mono' }} />
          <ReferenceDot x={s3.V} y={s3.P/1000} r={5} fill="#111827" stroke="white" strokeWidth={2} label={{ value:'3', position:'bottom', fill:'#111827', fontSize:11, fontFamily:'JetBrains Mono' }} />
          <ReferenceDot x={s4.V} y={s4.P/1000} r={5} fill="#111827" stroke="white" strokeWidth={2} label={{ value:'4', position:'bottom', fill:'#111827', fontSize:11, fontFamily:'JetBrains Mono' }} />

          {dotPt && (
            <ReferenceDot x={dotPt.V} y={dotPt.P} r={8} fill={PROCESS_COLORS[processIdx]} stroke="white" strokeWidth={2.5} />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center -mt-2 mb-2">
        {[
          { label:'1→2 Isothermal T_H', c:'#f97316' },
          { label:'2→3 Adiabatic',      c:'#a855f7' },
          { label:'3→4 Isothermal T_C', c:'#3b82f6' },
          { label:'4→1 Adiabatic',      c:'#22c55e' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded" style={{ background: l.c }} />
            <span className="font-mono text-[10px] text-gray-400">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────
export default function CarnotCycleModule() {
  const { darkMode, setDarkMode } = useApp()
  const [processIdx,   setProcessIdx]   = useState(0)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [speed,        setSpeed]        = useState(1)
  const [dotProgress,  setDotProgress]  = useState(0)
  const [showSliders,  setShowSliders]  = useState(false)
  const [T_H, setTH] = useState(800)
  const [T_C, setTC] = useState(300)
  const [n,   setN]  = useState(1)
  const [V1,  setV1] = useState(1)
  const [V2,  setV2] = useState(4)
  const [gamma, setGamma] = useState(1.4)

  const dotRef = useRef(null)

  // Animate dot, auto-advance when done
  useEffect(() => {
    cancelAnimationFrame(dotRef.current)
    if (!isPlaying) return

    const DURATION = 2400 / speed
    let start = null

    const tick = (ts) => {
      if (!start) start = ts
      const t = Math.min((ts - start) / DURATION, 1)
      setDotProgress(t)
      if (t < 1) {
        dotRef.current = requestAnimationFrame(tick)
      } else {
        setProcessIdx(p => (p + 1) % 4)
        setDotProgress(0)
        start = null
        dotRef.current = requestAnimationFrame(tick)
      }
    }
    dotRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(dotRef.current)
  }, [isPlaying, speed])

  const goTo = (idx) => {
    cancelAnimationFrame(dotRef.current)
    setIsPlaying(false)
    setProcessIdx(idx)
    setDotProgress(0)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      className="min-h-screen bg-[#fafafa] dark:bg-[#0f172a] transition-colors duration-300 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <BackButton />
        <div className="text-center">
          <h1 className="font-serif text-2xl font-bold text-gray-900 dark:text-white">Carnot Cycle</h1>
          <p className="font-sans text-xs text-gray-400 mt-0.5">Four reversible processes of an ideal heat engine</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSliders(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-300 text-sm font-sans transition-colors hover:text-gray-900 dark:hover:text-white">
            <SlidersHorizontal size={14} /><span>Params</span>
          </button>
          <button onClick={() => setDarkMode(d => !d)}
            className="w-8 h-8 rounded-full bg-white dark:bg-[#1e293b] shadow-sm flex items-center justify-center text-gray-500 dark:text-gray-300 transition-colors hover:text-gray-900 dark:hover:text-white">
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {/* Params panel */}
      <AnimatePresence>
        {showSliders && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
            className="overflow-hidden border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1e293b]">
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label:'T_H (K)', value:T_H, set:setTH, min:300, max:1500, step:10 },
                { label:'T_C (K)', value:T_C, set:setTC, min:50,  max:900,  step:10 },
                { label:'n (mol)', value:n,   set:setN,  min:0.1, max:5,    step:0.1 },
                { label:'V₁ (L)', value:V1,   set:setV1, min:0.1, max:5,    step:0.1 },
                { label:'V₂ (L)', value:V2,   set:setV2, min:0.5, max:20,   step:0.5 },
              ].map(s => (
                <div key={s.label} className="space-y-1">
                  <div className="flex justify-between">
                    <label className="font-mono text-xs text-gray-500 dark:text-gray-400">{s.label}</label>
                    <span className="font-mono text-xs text-amber-600 dark:text-amber-400">{s.value}</span>
                  </div>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                    onChange={e => s.set(parseFloat(e.target.value))} className="w-full h-1.5 accent-amber-500" />
                </div>
              ))}
              <div className="space-y-1">
                <label className="font-mono text-xs text-gray-500 dark:text-gray-400">γ</label>
                <select value={gamma} onChange={e => setGamma(parseFloat(e.target.value))}
                  className="w-full text-xs font-mono bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 text-gray-700 dark:text-gray-300">
                  <option value={1.667}>Monatomic (1.667)</option>
                  <option value={1.4}>Diatomic (1.4)</option>
                </select>
              </div>
            </div>
            {T_H <= T_C && <p className="px-6 pb-3 font-sans text-xs text-red-500">T_H must be greater than T_C</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PV Diagram — full width */}
      <div className="mx-6 mt-5 bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 px-4 pt-4 pb-1">
        <p className="font-serif text-sm font-semibold text-gray-700 dark:text-gray-200 px-2 mb-1">P–V Diagram</p>
        {T_H > T_C
          ? <FullPVDiagram processIdx={processIdx} dotProgress={dotProgress} n={n} T_H={T_H} T_C={T_C} V1={V1} V2={V2} gamma={gamma} />
          : <div className="flex items-center justify-center h-56 text-gray-400 font-sans text-sm">T_H must be greater than T_C</div>
        }
      </div>

      {/* 4 Cylinders — all visible simultaneously */}
      <div className="mx-6 mt-5">
        <div className="grid grid-cols-4 gap-3">
          {[0,1,2,3].map(i => {
            const active = i === processIdx
            return (
              <motion.button key={i} onClick={() => goTo(i)}
                animate={{ opacity: active ? 1 : 0.4, scale: active ? 1 : 0.97 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center rounded-2xl py-4 px-2 focus:outline-none relative"
                style={{
                  background: active ? `${PROCESS_COLORS[i]}10` : 'transparent',
                  border: `2px solid ${active ? PROCESS_COLORS[i] : 'transparent'}`,
                  boxShadow: active ? `0 0 20px ${PROCESS_COLORS[i]}28` : 'none',
                }}>
                {/* Label */}
                <span className="font-mono text-[10px] font-bold mb-2" style={{ color: active ? PROCESS_COLORS[i] : '#94a3b8' }}>
                  {PROCESS_LABELS[i]}
                </span>

                <MiniCylinder active={active} color={PROCESS_COLORS[i]} gasColor={PROCESS_GAS[i]} pistonFrac={PISTON_FRACS[i]} />

                <div className="mt-3 text-center space-y-0.5 px-1">
                  <p className="font-sans text-[11px] font-semibold text-gray-700 dark:text-gray-200 leading-tight">{PROCESS_NAMES[i]}</p>
                  <p className="font-mono text-[10px]" style={{ color: PROCESS_COLORS[i] }}>{PROCESS_EQS[i]}</p>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 py-6 mt-auto">
        <button onClick={() => goTo((processIdx+3)%4)}
          className="w-9 h-9 rounded-full bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>

        <button onClick={() => setIsPlaying(p => !p)}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md hover:scale-105 transition-all"
          style={{ background:`linear-gradient(135deg, ${PROCESS_COLORS[processIdx]}, ${PROCESS_COLORS[(processIdx+1)%4]})` }}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <button onClick={() => goTo((processIdx+1)%4)}
          className="w-9 h-9 rounded-full bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
          <ChevronRight size={18} />
        </button>

        <div className="flex items-center gap-2 ml-2">
          <span className="font-mono text-xs text-gray-400">Speed</span>
          <input type="range" min={0.5} max={3} step={0.5} value={speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
            className="w-20 h-1.5 accent-amber-500" />
          <span className="font-mono text-xs text-amber-600 dark:text-amber-400">{speed}×</span>
        </div>
      </div>
    </motion.div>
  )
}
