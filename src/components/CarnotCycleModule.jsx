import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, ChevronLeft, ChevronRight, SlidersHorizontal, Moon, Sun } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, ReferenceDot, Tooltip
} from 'recharts'
import BackButton from './BackButton'
import { allStates, isothermPoints, adiabaticPoints } from '../utils/carnotPhysics'
import { useApp } from '../context/AppContext'

// ── Process metadata ──────────────────────────────────────────────────────────
const PROCESSES = [
  {
    label: '1 → 2',
    name: 'Isothermal Expansion',
    type: 'isothermal',
    color: '#f97316',
    gasColor: 'rgba(251,146,60,0.45)',
    gasEdge: '#fb923c',
    equation: 'PV = nRT_H = const',
    description: 'Gas absorbs heat Q_H from hot reservoir at constant T_H',
    heatFlow: 'in',
    pistonFrac: 0.28,   // piston top as fraction of cylinder height (0=top, 1=bottom)
  },
  {
    label: '2 → 3',
    name: 'Adiabatic Expansion',
    type: 'adiabatic',
    color: '#a855f7',
    gasColor: 'rgba(168,85,247,0.3)',
    gasEdge: '#a855f7',
    equation: 'PV^γ = const, Q = 0',
    description: 'Thermally insulated — gas cools as it expands and does work',
    heatFlow: 'none',
    pistonFrac: 0.52,
  },
  {
    label: '3 → 4',
    name: 'Isothermal Compression',
    type: 'isothermal',
    color: '#3b82f6',
    gasColor: 'rgba(96,165,250,0.4)',
    gasEdge: '#60a5fa',
    equation: 'PV = nRT_C = const',
    description: 'Gas rejects heat Q_C to cold reservoir at constant T_C',
    heatFlow: 'out',
    pistonFrac: 0.70,
  },
  {
    label: '4 → 1',
    name: 'Adiabatic Compression',
    type: 'adiabatic',
    color: '#22c55e',
    gasColor: 'rgba(34,197,94,0.3)',
    gasEdge: '#22c55e',
    equation: 'PV^γ = const, Q = 0',
    description: 'Thermally insulated — gas warms as it is compressed back',
    heatFlow: 'none',
    pistonFrac: 0.45,
  },
]

// ── Mini cylinder SVG ─────────────────────────────────────────────────────────
function MiniCylinder({ proc, active, index }) {
  const W = 88, H = 160
  const wallX = 12, wallW = W - 24
  const topY = 22, botY = H - 18
  const cylH = botY - topY
  const pistonH = 14
  const pistonY = topY + proc.pistonFrac * (cylH - pistonH)
  const gasH = Math.max(0, botY - (pistonY + pistonH))

  // molecules inside gas region
  const molCount = 7
  const molecules = useMemo(() => Array.from({ length: molCount }, (_, i) => ({
    x: wallX + 6 + (i * 11) % (wallW - 12),
    y: pistonY + pistonH + 8 + (i * 17) % Math.max(4, gasH - 16),
    r: 2.2 + (i % 3) * 0.6,
  })), [pistonY, pistonH, gasH, wallW, wallX])

  return (
    <div
      className="flex flex-col items-center"
      style={{ opacity: active ? 1 : 0.42, transition: 'opacity 0.35s ease' }}
    >
      {/* cylinder card */}
      <div
        className="rounded-xl overflow-hidden transition-all duration-300"
        style={{
          boxShadow: active
            ? `0 0 0 2.5px ${proc.color}, 0 6px 24px ${proc.color}44`
            : '0 1px 6px rgba(0,0,0,0.07)',
          background: active ? `${proc.color}08` : 'white',
          border: active ? `2px solid ${proc.color}` : '2px solid #f1f5f9',
        }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {/* cylinder outer wall */}
          <rect x={wallX - 5} y={topY - 6} width={wallW + 10} height={cylH + 12}
            rx="5" fill="#cbd5e1" />
          {/* cylinder interior */}
          <rect x={wallX} y={topY} width={wallW} height={cylH} fill="#1e293b" />
          {/* gas fill */}
          {gasH > 0 && (
            <>
              <rect x={wallX + 1} y={pistonY + pistonH} width={wallW - 2} height={gasH}
                fill={proc.gasColor} />
              <rect x={wallX + 1} y={pistonY + pistonH} width={wallW - 2} height="3"
                fill={proc.gasEdge} fillOpacity="0.5" />
            </>
          )}
          {/* molecules */}
          {gasH > 8 && molecules.map((m, i) => (
            <motion.circle key={i}
              cx={m.x} cy={m.y} r={m.r}
              fill={proc.gasEdge} fillOpacity="0.8"
              animate={active ? {
                cx: [m.x, m.x + (i % 2 === 0 ? 4 : -4), m.x],
                cy: [m.y, m.y + (i % 3 === 0 ? -4 : 3), m.y],
              } : {}}
              transition={{ duration: 0.6 + i * 0.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.07 }}
            />
          ))}
          {/* piston rod */}
          <line x1={W / 2} y1={topY - 6} x2={W / 2} y2={pistonY}
            stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
          <line x1={W / 2} y1={topY - 6} x2={W / 2} y2={pistonY}
            stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
          {/* piston body */}
          <rect x={wallX + 3} y={pistonY} width={wallW - 6} height={pistonH} rx="2.5" fill="#94a3b8" />
          <rect x={wallX + 3} y={pistonY} width={wallW - 6} height="4" rx="2" fill="#475569" />
          <rect x={wallX + 3} y={pistonY + pistonH - 4} width={wallW - 6} height="4" rx="2" fill="#475569" />
          <rect x={wallX + 8} y={pistonY + 5} width={(wallW - 12) / 2} height="2" rx="1" fill="white" fillOpacity="0.3" />

          {/* heat flow indicator */}
          {proc.heatFlow === 'in' && (
            <>
              <polygon points={`${W / 2 - 5},${botY + 5} ${W / 2 + 5},${botY + 5} ${W / 2},${botY - 2}`}
                fill="#f97316" fillOpacity="0.9" />
              {active && [0, 1].map(i => (
                <motion.circle key={i} cx={W / 2 + (i === 0 ? -5 : 5)} cy={botY + 8} r="3"
                  fill="#f97316" fillOpacity="0.8"
                  animate={{ cy: [botY + 8, botY - 4], opacity: [0, 0.9, 0] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.35 }} />
              ))}
            </>
          )}
          {proc.heatFlow === 'out' && (
            <>
              <polygon points={`${W / 2 - 5},${botY - 2} ${W / 2 + 5},${botY - 2} ${W / 2},${botY + 5}`}
                fill="#3b82f6" fillOpacity="0.9" />
              {active && [0, 1].map(i => (
                <motion.circle key={i} cx={W / 2 + (i === 0 ? -5 : 5)} cy={botY - 4} r="3"
                  fill="#3b82f6" fillOpacity="0.8"
                  animate={{ cy: [botY - 4, botY + 8], opacity: [0, 0.9, 0] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.35 }} />
              ))}
            </>
          )}
          {proc.heatFlow === 'none' && (
            <>
              <line x1={wallX - 4} y1={topY + cylH * 0.3} x2={wallX - 1} y2={topY + cylH * 0.3 + 5}
                stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
              <line x1={wallX - 4} y1={topY + cylH * 0.5} x2={wallX - 1} y2={topY + cylH * 0.5 + 5}
                stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
              <line x1={wallX + wallW + 1} y1={topY + cylH * 0.3} x2={wallX + wallW + 4} y2={topY + cylH * 0.3 + 5}
                stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
              <line x1={wallX + wallW + 1} y1={topY + cylH * 0.5} x2={wallX + wallW + 4} y2={topY + cylH * 0.5 + 5}
                stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
            </>
          )}
        </svg>
      </div>

      {/* label block */}
      <div className="mt-2 text-center px-1">
        <p className="font-mono text-xs font-bold" style={{ color: proc.color }}>{proc.label}</p>
        <p className="font-sans text-[10px] font-semibold text-gray-700 dark:text-gray-200 leading-tight mt-0.5">{proc.name}</p>
        <p className="font-mono text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{proc.equation}</p>
      </div>
    </div>
  )
}

// ── PV diagram (full width, clean) ────────────────────────────────────────────
const COLORS = { p12: '#f97316', p23: '#a855f7', p34: '#3b82f6', p41: '#22c55e' }

function FullPVDiagram({ processIdx, n, T_H, T_C, V1, V2, gamma, dotProgress }) {
  const states = useMemo(() => {
    try { return allStates(n, T_H, T_C, V1, V2, gamma) } catch { return null }
  }, [n, T_H, T_C, V1, V2, gamma])

  const curves = useMemo(() => {
    if (!states) return null
    const { s1, s2, s3, s4 } = states
    return {
      p12: isothermPoints(n, T_H, V1, V2),
      p23: adiabaticPoints(s2.P / 1000, V2, gamma, s3.V),
      p34: isothermPoints(n, T_C, s3.V, s4.V),
      p41: adiabaticPoints(s4.P / 1000, s4.V, gamma, V1),
    }
  }, [states, n, T_H, T_C, V1, V2, gamma])

  if (!states || !curves) {
    return <div className="flex items-center justify-center h-64 text-gray-400 font-sans text-sm">T_H must be greater than T_C</div>
  }

  const { s1, s2, s3, s4 } = states
  const allPts = [...curves.p12, ...curves.p23, ...curves.p34, ...curves.p41]
  const maxP = Math.max(...allPts.map(p => p.P)) * 1.12
  const maxV = Math.max(...allPts.map(p => p.V)) * 1.08
  const minV = Math.min(...allPts.map(p => p.V)) * 0.92

  const curveArr = [curves.p12, curves.p23, curves.p34, curves.p41]
  const cur = curveArr[processIdx]
  const dotIdx = Math.min(Math.floor(dotProgress * (cur.length - 1)), cur.length - 1)
  const dotPt = cur[dotIdx]

  const labelPos = [
    { x: s1.V, y: s1.P / 1000, lx: -14, ly: -10, label: '1' },
    { x: s2.V, y: s2.P / 1000, lx: 6, ly: -10, label: '2' },
    { x: s3.V, y: s3.P / 1000, lx: 6, ly: 14, label: '3' },
    { x: s4.V, y: s4.P / 1000, lx: -14, ly: 14, label: '4' },
  ]

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart margin={{ top: 16, right: 28, left: 8, bottom: 36 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" strokeOpacity="0.7" />
          <XAxis dataKey="V" type="number" domain={[minV, maxV]}
            label={{ value: 'Volume (L)', position: 'insideBottom', offset: -14, fontSize: 11, fill: '#94a3b8', fontFamily: 'monospace' }}
            tickFormatter={v => v.toFixed(1)} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDataOverflow />
          <YAxis dataKey="P" type="number" domain={[0, maxP]}
            label={{ value: 'Pressure (kPa)', angle: -90, position: 'insideLeft', offset: 18, fontSize: 11, fill: '#94a3b8', fontFamily: 'monospace' }}
            tickFormatter={v => v.toFixed(0)} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDataOverflow />
          <Tooltip
            formatter={(v) => [v.toFixed(2)]}
            contentStyle={{ fontFamily: 'monospace', fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />

          <Line data={curves.p12} dataKey="P" dot={false} name="1→2 Isothermal (T_H)"
            stroke={COLORS.p12} strokeWidth={processIdx === 0 ? 3 : 1.8}
            strokeOpacity={processIdx === 0 ? 1 : 0.35} isAnimationActive={false} />
          <Line data={curves.p23} dataKey="P" dot={false} name="2→3 Adiabatic"
            stroke={COLORS.p23} strokeWidth={processIdx === 1 ? 3 : 1.8}
            strokeOpacity={processIdx === 1 ? 1 : 0.35} isAnimationActive={false} />
          <Line data={curves.p34} dataKey="P" dot={false} name="3→4 Isothermal (T_C)"
            stroke={COLORS.p34} strokeWidth={processIdx === 2 ? 3 : 1.8}
            strokeOpacity={processIdx === 2 ? 1 : 0.35} isAnimationActive={false} />
          <Line data={curves.p41} dataKey="P" dot={false} name="4→1 Adiabatic"
            stroke={COLORS.p41} strokeWidth={processIdx === 3 ? 3 : 1.8}
            strokeOpacity={processIdx === 3 ? 1 : 0.35} isAnimationActive={false} />

          {/* state point dots */}
          {labelPos.map(pt => (
            <ReferenceDot key={pt.label} x={pt.x} y={pt.y}
              r={5} fill="#1e293b" stroke="white" strokeWidth={2}
              label={{ value: pt.label, position: pt.ly < 0 ? 'top' : 'bottom', fill: '#1e293b', fontSize: 11, fontFamily: 'monospace', fontWeight: '700' }} />
          ))}

          {/* traveling dot */}
          {dotPt && (
            <ReferenceDot x={dotPt.V} y={dotPt.P}
              r={8} fill="white" stroke={Object.values(COLORS)[processIdx]} strokeWidth={3} />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* legend row */}
      <div className="flex flex-wrap gap-4 justify-center mt-1 mb-2">
        {[
          { label: '1→2  Isothermal (T_H)', color: COLORS.p12 },
          { label: '2→3  Adiabatic', color: COLORS.p23 },
          { label: '3→4  Isothermal (T_C)', color: COLORS.p34 },
          { label: '4→1  Adiabatic', color: COLORS.p41 },
        ].map((l, i) => (
          <div key={l.label} className="flex items-center gap-1.5"
            style={{ opacity: processIdx === i ? 1 : 0.45, transition: 'opacity 0.25s' }}>
            <div className="w-6 h-[2.5px] rounded" style={{ background: l.color }} />
            <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main module ───────────────────────────────────────────────────────────────
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
  const [dotProgress, setDotProgress] = useState(0)
  const intervalRef = useRef(null)
  const dotRafRef = useRef(null)
  const dotStartRef = useRef(null)

  // animate traveling dot on processIdx change
  useEffect(() => {
    cancelAnimationFrame(dotRafRef.current)
    dotStartRef.current = null
    setDotProgress(0)
    const dur = 2200 / speed
    const tick = (ts) => {
      if (!dotStartRef.current) dotStartRef.current = ts
      const t = Math.min((ts - dotStartRef.current) / dur, 1)
      setDotProgress(t)
      if (t < 1) dotRafRef.current = requestAnimationFrame(tick)
    }
    dotRafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(dotRafRef.current)
  }, [processIdx, speed])

  // auto-advance
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => setProcessIdx(p => (p + 1) % 4), 2400 / speed)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [isPlaying, speed])

  const prev = () => { setProcessIdx(p => (p + 3) % 4); setIsPlaying(false) }
  const next = () => { setProcessIdx(p => (p + 1) % 4); setIsPlaying(false) }

  const proc = PROCESSES[processIdx]

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
      className="min-h-screen bg-[#fafafa] dark:bg-[#0f172a] transition-colors duration-300">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
        <BackButton />
        <div className="text-center">
          <h1 className="font-serif text-2xl font-bold text-gray-900 dark:text-white">Carnot Cycle</h1>
          <p className="font-sans text-xs text-gray-400 mt-0.5">Four reversible processes of an ideal heat engine</p>
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
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
              <div className="space-y-1">
                <label className="font-mono text-xs text-gray-500 dark:text-gray-400">γ</label>
                <select value={gamma} onChange={e => setGamma(parseFloat(e.target.value))}
                  className="w-full text-xs font-mono bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 text-gray-700 dark:text-gray-300">
                  <option value={1.667}>Monatomic (1.667)</option>
                  <option value={1.4}>Diatomic (1.4)</option>
                </select>
              </div>
            </div>
            {T_H <= T_C && <p className="px-6 pb-3 font-sans text-xs text-red-500">T_H must be greater than T_C</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PV Diagram (full width) ── */}
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 px-5 pt-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-serif text-base font-semibold text-gray-800 dark:text-white">P–V Diagram</h3>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold"
              style={{ background: `${proc.color}18`, color: proc.color }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: proc.color }} />
              {proc.name}
            </div>
          </div>
          {T_H > T_C
            ? <FullPVDiagram processIdx={processIdx} n={n} T_H={T_H} T_C={T_C} V1={V1} V2={V2} gamma={gamma} dotProgress={dotProgress} />
            : <div className="flex items-center justify-center h-64 text-gray-400 font-sans text-sm">T_H must be greater than T_C</div>
          }
        </div>
      </div>

      {/* ── Active process info strip ── */}
      <div className="max-w-5xl mx-auto px-6 mt-4">
        <AnimatePresence mode="wait">
          <motion.div key={processIdx}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl px-5 py-3 flex items-center gap-4"
            style={{ background: `${proc.color}12`, border: `1px solid ${proc.color}30` }}>
            <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ background: proc.color }} />
            <div>
              <p className="font-mono text-sm font-bold" style={{ color: proc.color }}>{proc.label} — {proc.name}</p>
              <p className="font-sans text-xs text-gray-500 dark:text-gray-400 mt-0.5">{proc.description}</p>
            </div>
            <div className="ml-auto flex-shrink-0 font-mono text-xs px-3 py-1 rounded-lg bg-white dark:bg-[#0f172a] border border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400">
              {proc.equation}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Four cylinders side by side ── */}
      <div className="max-w-5xl mx-auto px-6 mt-5">
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5">
          <p className="font-sans text-xs text-gray-400 dark:text-gray-500 mb-4 text-center tracking-wide uppercase font-medium">
            All four processes — active step highlighted
          </p>
          <div className="grid grid-cols-4 gap-3 justify-items-center">
            {PROCESSES.map((p, i) => (
              <button key={i} onClick={() => { setProcessIdx(i); setIsPlaying(false) }}
                className="focus:outline-none w-full flex flex-col items-center">
                <MiniCylinder proc={p} active={i === processIdx} index={i} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-col items-center gap-3 py-6">
        {/* step pills */}
        <div className="flex gap-2">
          {PROCESSES.map((p, i) => (
            <button key={i}
              onClick={() => { setProcessIdx(i); setIsPlaying(false) }}
              className="px-3 py-1 rounded-full text-xs font-mono font-semibold transition-all duration-200"
              style={{
                background: processIdx === i ? p.color : 'transparent',
                color: processIdx === i ? 'white' : p.color,
                border: `1.5px solid ${p.color}`,
                transform: processIdx === i ? 'scale(1.06)' : 'scale(1)',
              }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* playback row */}
        <div className="flex items-center gap-3">
          <button onClick={prev}
            className="w-9 h-9 rounded-full bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setIsPlaying(!isPlaying)}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md hover:scale-105 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button onClick={next}
            className="w-9 h-9 rounded-full bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ChevronRight size={18} />
          </button>
          <div className="flex items-center gap-2 ml-2">
            <span className="font-mono text-xs text-gray-400">Speed</span>
            <input type="range" min={0.5} max={3} step={0.5} value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
              className="w-20 h-1.5 accent-amber-500" />
            <span className="font-mono text-xs text-amber-600">{speed}×</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
