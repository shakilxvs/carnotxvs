import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { Play, Pause, RotateCcw, Gauge, SlidersHorizontal, Moon, Sun, Flame, Snowflake } from 'lucide-react'
import BackButton from './BackButton'
import { efficiency, heatAbsorbed, heatRejected, netWork, copR, copHP } from '../utils/carnotPhysics'
import { useApp } from '../context/AppContext'

function CircularGauge({ value, size = 100 }) {
  const pct = Math.min(Math.max(value, 0), 1)
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const stroke = circ * pct
  const color = pct > 0.7 ? '#22c55e' : pct > 0.4 ? '#f59e0b' : '#ef4444'

  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={`${stroke} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      <text x={size/2} y={size/2 - 4} textAnchor="middle" fill={color} fontSize="14" fontWeight="700" fontFamily="JetBrains Mono">
        {(pct * 100).toFixed(1)}%
      </text>
      <text x={size/2} y={size/2 + 12} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="DM Sans">
        efficiency
      </text>
    </svg>
  )
}

function Flywheel({ speed }) {
  return (
    <motion.svg
      width="64" height="64"
      animate={{ rotate: 360 }}
      transition={{ duration: Math.max(0.3, 3 - speed * 0.8), repeat: Infinity, ease: 'linear' }}
    >
      <circle cx="32" cy="32" r="28" fill="none" stroke="#eab308" strokeWidth="4" />
      <circle cx="32" cy="32" r="6" fill="#eab308" />
      {[0, 60, 120, 180, 240, 300].map(a => {
        const rad = a * Math.PI / 180
        return <line key={a} x1="32" y1="32" x2={32 + 22 * Math.cos(rad)} y2={32 + 22 * Math.sin(rad)} stroke="#eab308" strokeWidth="2" />
      })}
    </motion.svg>
  )
}

function HeatParticles({ color, fromY, toY, active }) {
  const particles = [0, 1, 2]
  return (
    <div className="relative w-1 overflow-visible" style={{ height: Math.abs(toY - fromY) }}>
      {active && particles.map(i => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{ background: color, left: -3, top: fromY < toY ? 0 : undefined, bottom: fromY > toY ? 0 : undefined }}
          animate={{ y: fromY < toY ? ['0%', '100%'] : ['0%', '-100%'], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5, ease: 'linear' }}
        />
      ))}
    </div>
  )
}

export default function EngineModule() {
  const { darkMode, setDarkMode } = useApp()
  const [T_H, setTH] = useState(800)
  const [T_C, setTC] = useState(300)
  const [n, setN] = useState(1)
  const [V1, setV1] = useState(1)
  const [V2, setV2] = useState(4)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showSliders, setShowSliders] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(() => setTick(t => t + 1), 50)
    return () => clearInterval(id)
  }, [isPlaying])

  const eta = T_H > T_C ? efficiency(T_H, T_C) : 0
  const Q_H = heatAbsorbed(n, T_H, V1, V2)
  const Q_C = Math.abs(heatRejected(n, T_C, V2 * Math.pow(T_H / T_C, 1 / 0.4), V1 * Math.pow(T_H / T_C, 1 / 0.4)))
  const W_net = netWork(Q_H, Q_C)
  const COP_R = T_H > T_C ? copR(T_H, T_C) : 0
  const COP_HP = T_H > T_C ? copHP(T_H, T_C) : 0

  const fmt = v => {
    if (Math.abs(v) > 1e6) return (v / 1e6).toFixed(2) + 'M'
    if (Math.abs(v) > 1e3) return (v / 1e3).toFixed(2) + 'k'
    return v.toFixed(2)
  }

  const boxBase = "rounded-2xl border p-4"
  const hotBox = `${boxBase} border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30`
  const engineBox = `${boxBase} border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20`
  const coldBox = `${boxBase} border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30`

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
          <h1 className="font-serif text-2xl font-bold text-gray-900 dark:text-white">Carnot Engine</h1>
          <p className="font-sans text-xs text-gray-400 mt-0.5">Schematic energy flow</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSliders(!showSliders)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm font-sans transition-colors">
            <SlidersHorizontal size={15} />
          </button>
          <button onClick={() => setDarkMode(!darkMode)} className="w-8 h-8 rounded-full bg-white dark:bg-[#1e293b] shadow-sm flex items-center justify-center text-gray-500 dark:text-gray-300 transition-colors">
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {/* Sliders */}
      <AnimatePresence>
        {showSliders && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1e293b]">
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-4">
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
                    <span className="font-mono text-xs text-amber-600">{s.value}</span>
                  </div>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={e => s.set(parseFloat(e.target.value))} className="w-full h-1.5 accent-amber-500" />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schematic */}
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-0">
        {/* Hot Reservoir */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className={hotBox}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                <Flame size={20} className="text-red-500" />
              </div>
              <div>
                <p className="font-sans text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Hot Reservoir</p>
                <p className="font-mono text-sm text-gray-700 dark:text-gray-200 mt-0.5">T_H = {T_H} K</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Q_H Arrow */}
        <div className="flex flex-col items-center py-1 relative">
          <div className="w-px h-12 relative overflow-visible flex items-center justify-center">
            <svg width="40" height="48" className="absolute" style={{ left: '50%', transform: 'translateX(-50%)' }}>
              <defs>
                <marker id="arrowR" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" />
                </marker>
              </defs>
              <line x1="20" y1="4" x2="20" y2="42" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="4,3" markerEnd="url(#arrowR)" />
              {isPlaying && [0, 1, 2].map(i => (
                <circle key={i} r="3" fill="#ef4444">
                  <animate attributeName="cy" values="4;44" dur="1.2s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;1;1;0" dur="1.2s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                  <animateTransform attributeName="transform" type="translate" values="20,0;20,0" dur="1.2s" repeatCount="indefinite" />
                </circle>
              ))}
            </svg>
          </div>
          <span className="font-mono text-xs text-red-500 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full">Q_H = {fmt(Q_H)} J</span>
        </div>

        {/* Engine box */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className={engineBox}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CircularGauge value={eta} size={90} />
              <div>
                <p className="font-sans text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Engine</p>
                <p className="font-mono text-sm text-gray-700 dark:text-gray-200 mt-1">η = {(eta * 100).toFixed(1)}%</p>
                <p className="font-mono text-xs text-gray-400 mt-0.5">W_net = {fmt(W_net)} J</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Flywheel speed={isPlaying ? Math.max(1, W_net / Q_H * 5) : 0} />
              <div className="flex items-center gap-1">
                <svg width="20" height="12">
                  <defs><marker id="arrowW" markerWidth="5" markerHeight="5" refX="3" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 Z" fill="#eab308" /></marker></defs>
                  <line x1="0" y1="6" x2="16" y2="6" stroke="#eab308" strokeWidth="2" markerEnd="url(#arrowW)" />
                </svg>
                <span className="font-mono text-xs text-yellow-600">{fmt(W_net)} J</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Q_C Arrow */}
        <div className="flex flex-col items-center py-1 relative">
          <span className="font-mono text-xs text-blue-500 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-full">Q_C = {fmt(Q_C)} J</span>
          <div className="w-px h-12 relative overflow-visible flex items-center justify-center">
            <svg width="40" height="48" className="absolute" style={{ left: '50%', transform: 'translateX(-50%)' }}>
              <defs>
                <marker id="arrowB" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#3b82f6" />
                </marker>
              </defs>
              <line x1="20" y1="4" x2="20" y2="42" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="4,3" markerEnd="url(#arrowB)" />
              {isPlaying && [0, 1, 2].map(i => (
                <circle key={i} r="3" fill="#3b82f6">
                  <animate attributeName="cy" values="4;44" dur="1.2s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;1;1;0" dur="1.2s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                </circle>
              ))}
            </svg>
          </div>
        </div>

        {/* Cold Reservoir */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={coldBox}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Snowflake size={20} className="text-blue-500" />
            </div>
            <div>
              <p className="font-sans text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Cold Reservoir</p>
              <p className="font-mono text-sm text-gray-700 dark:text-gray-200 mt-0.5">T_C = {T_C} K</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 pb-6">
        <button onClick={() => { setIsPlaying(false); setTick(0) }} className="w-9 h-9 rounded-full bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
          <RotateCcw size={15} />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md hover:scale-105 transition-all"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #4f46e5)' }}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>

      {/* Value strip */}
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
