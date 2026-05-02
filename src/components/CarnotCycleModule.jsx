import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, ChevronLeft, ChevronRight, SlidersHorizontal, X, Moon, Sun } from 'lucide-react'
import BackButton from './BackButton'
import CylinderAnimation from './CylinderAnimation'
import PVDiagram from './PVDiagram'
import { useApp } from '../context/AppContext'

const PROCESS_LABELS = ['1 → 2', '2 → 3', '3 → 4', '4 → 1']
const PROCESS_COLORS = ['#f97316', '#a855f7', '#3b82f6', '#22c55e']

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
      intervalRef.current = setInterval(() => {
        setProcessIdx(p => (p + 1) % 4)
      }, 2500 / speed)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [isPlaying, speed])

  const prev = () => setProcessIdx(p => (p + 3) % 4)
  const next = () => setProcessIdx(p => (p + 1) % 4)

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
            <SlidersHorizontal size={15} />
            <span>Params</span>
          </button>
          <button onClick={() => setDarkMode(!darkMode)} className="w-8 h-8 rounded-full bg-white dark:bg-[#1e293b] shadow-sm flex items-center justify-center text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {/* Sliders panel */}
      <AnimatePresence>
        {showSliders && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1e293b]"
          >
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
            {T_H <= T_C && (
              <p className="px-6 pb-3 font-sans text-xs text-red-500 flex items-center gap-1">
                T_H must be greater than T_C
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 max-w-6xl mx-auto">
        {/* LEFT: Cylinder */}
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 flex flex-col items-center justify-center">
          <CylinderAnimation processIdx={processIdx} T_H={T_H} T_C={T_C} />
        </div>

        {/* RIGHT: PV Diagram */}
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 flex flex-col">
          <h3 className="font-serif text-base font-semibold text-gray-800 dark:text-white mb-4">P–V Diagram</h3>
          <div className="flex-1">
            {T_H > T_C ? (
              <PVDiagram processIdx={processIdx} n={n} T_H={T_H} T_C={T_C} V1={V1} V2={V2} gamma={gamma} />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400 font-sans text-sm">
                T_H must be greater than T_C
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-4 pb-8 px-6">
        {/* Process pills */}
        <div className="flex gap-2">
          {PROCESS_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => { setProcessIdx(i); setIsPlaying(false) }}
              className="px-4 py-1.5 rounded-full text-xs font-mono font-medium transition-all duration-200"
              style={{
                background: processIdx === i ? PROCESS_COLORS[i] : 'transparent',
                color: processIdx === i ? 'white' : PROCESS_COLORS[i],
                border: `1.5px solid ${PROCESS_COLORS[i]}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-3">
          <button onClick={prev} className="w-9 h-9 rounded-full bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button onClick={next} className="w-9 h-9 rounded-full bg-white dark:bg-[#1e293b] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
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
