import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Copy, Check, ChevronDown, ChevronUp, Moon, Sun } from 'lucide-react'
import BackButton from './BackButton'
import { efficiency, heatAbsorbed, heatRejected, netWork, copR, copHP, allStates, R } from '../utils/carnotPhysics'
import { toKelvin, allUnits } from '../utils/temperatureUnits'
import { useApp } from '../context/AppContext'

function TempInput({ label, value, setValue, unit, setUnit }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <div className="flex gap-2">
        <input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-mono text-sm bg-white dark:bg-[#0f172a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {['K', 'C', 'F'].map(u => (
            <button key={u} onClick={() => setUnit(u)}
              className="px-2.5 py-1.5 text-xs font-mono transition-colors"
              style={{ background: unit === u ? '#f59e0b' : 'transparent', color: unit === u ? '#1a1a1a' : '#94a3b8' }}>
              {u === 'C' ? '°C' : u === 'F' ? '°F' : 'K'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function NumInput({ label, value, setValue, min, max, step = 1, unit = '' }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => setValue(e.target.value)}
          className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-mono text-sm bg-white dark:bg-[#0f172a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        {unit && <span className="font-mono text-xs text-gray-400">{unit}</span>}
      </div>
    </div>
  )
}

function ResultCard({ label, value, color = '#111827', mono = true }) {
  return (
    <div className="bg-gray-50 dark:bg-[#0f172a] rounded-xl p-3 border border-gray-100 dark:border-gray-800">
      <p className="font-sans text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-sm font-semibold ${mono ? 'font-mono' : 'font-sans'}`} style={{ color }}>{value}</p>
    </div>
  )
}

function Working({ lines }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-xs font-sans text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {open ? 'Hide working' : 'Show working'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2 space-y-1 border-l-2 border-amber-300 pl-3">
            {lines.map((l, i) => (
              <p key={i} className="font-mono text-xs text-gray-500 dark:text-gray-400">{l}</p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Tab1() {
  const [TH_val, setTHval] = useState('800')
  const [TH_unit, setTHunit] = useState('K')
  const [TC_val, setTCval] = useState('300')
  const [TC_unit, setTCunit] = useState('K')
  const [copied, setCopied] = useState(false)

  const T_H = toKelvin(TH_val, TH_unit)
  const T_C = toKelvin(TC_val, TC_unit)
  const valid = !isNaN(T_H) && !isNaN(T_C) && T_H > T_C && T_H > 0 && T_C > 0

  const eta = valid ? efficiency(T_H, T_C) : null
  const n = 1, V1 = 1, V2 = 4, gamma = 1.4
  const Q_H = valid ? heatAbsorbed(n, T_H, V1, V2) : null
  const V3 = valid ? V2 * Math.pow(T_H / T_C, 1 / (gamma - 1)) : null
  const V4 = valid ? V1 * Math.pow(T_H / T_C, 1 / (gamma - 1)) : null
  const Q_C_raw = valid ? heatRejected(n, T_C, V3, V4) : null
  const Q_C = valid ? Math.abs(Q_C_raw) : null
  const W = valid ? netWork(Q_H, Q_C) : null
  const COP_R = valid ? copR(T_H, T_C) : null
  const COP_HP = valid ? copHP(T_H, T_C) : null

  const copyAll = () => {
    if (!valid) return
    const txt = `η = ${(eta * 100).toFixed(4)}%\nQ_H = ${Q_H.toFixed(2)} J\nQ_C = ${Q_C.toFixed(2)} J\nW_net = ${W.toFixed(2)} J\nCOP_R = ${COP_R.toFixed(4)}\nCOP_HP = ${COP_HP.toFixed(4)}`
    navigator.clipboard.writeText(txt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TempInput label="T_H — Hot reservoir temperature" value={TH_val} setValue={setTHval} unit={TH_unit} setUnit={setTHunit} />
        <TempInput label="T_C — Cold reservoir temperature" value={TC_val} setValue={setTCval} unit={TC_unit} setUnit={setTCunit} />
      </div>

      {!isNaN(T_H) && !isNaN(T_C) && T_H <= T_C && (
        <div className="flex items-center gap-2 text-red-500 text-sm font-sans">
          <AlertCircle size={15} />
          <span>T_H must be strictly greater than T_C</span>
        </div>
      )}

      {valid && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-sans text-sm font-semibold text-gray-700 dark:text-gray-200">Results</h4>
            <button onClick={copyAll} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
              {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
              <span>{copied ? 'Copied!' : 'Copy all'}</span>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ResultCard label="η — Carnot Efficiency" value={`${(eta * 100).toFixed(4)} %`} color="#22c55e" />
            <ResultCard label="W_net — Net Work" value={`${W.toFixed(2)} J`} color="#eab308" />
            <ResultCard label="Q_H — Heat Absorbed" value={`${Q_H.toFixed(2)} J`} color="#ef4444" />
            <ResultCard label="Q_C — Heat Rejected" value={`${Q_C.toFixed(2)} J`} color="#3b82f6" />
            <ResultCard label="COP_R (Refrigerator)" value={COP_R.toFixed(4)} color="#a855f7" />
            <ResultCard label="COP_HP (Heat Pump)" value={COP_HP.toFixed(4)} color="#06b6d4" />
          </div>
          <Working lines={[
            `η = 1 - T_C / T_H`,
            `η = 1 - ${T_C.toFixed(2)} / ${T_H.toFixed(2)}`,
            `η = 1 - ${(T_C / T_H).toFixed(6)}`,
            `η = ${eta.toFixed(6)} = ${(eta * 100).toFixed(4)}%`,
            ``,
            `Q_H = n·R·T_H·ln(V₂/V₁) = 1 × 8.314 × ${T_H.toFixed(2)} × ln(4) = ${Q_H.toFixed(2)} J`,
            `Q_C = η · Q_H — subtracted = ${Q_C.toFixed(2)} J`,
            `W_net = Q_H - Q_C = ${Q_H.toFixed(2)} - ${Q_C.toFixed(2)} = ${W.toFixed(2)} J`,
            `COP_R = T_C / (T_H - T_C) = ${T_C.toFixed(2)} / ${(T_H - T_C).toFixed(2)} = ${COP_R.toFixed(4)}`,
            `COP_HP = T_H / (T_H - T_C) = ${T_H.toFixed(2)} / ${(T_H - T_C).toFixed(2)} = ${COP_HP.toFixed(4)}`,
          ]} />
        </motion.div>
      )}
    </div>
  )
}

function Tab2() {
  const [eta_val, setEtaVal] = useState('37.5')
  const [TH_val, setTHval] = useState('800')
  const [TH_unit, setTHunit] = useState('K')

  const eta = parseFloat(eta_val) / 100
  const T_H = toKelvin(TH_val, TH_unit)
  const valid = !isNaN(eta) && !isNaN(T_H) && eta > 0 && eta < 1 && T_H > 0

  const T_C = valid ? T_H * (1 - eta) : null
  const units = T_C ? allUnits(T_C) : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumInput label="η — Efficiency (%)" value={eta_val} setValue={setEtaVal} min={0.01} max={99.99} step={0.1} unit="%" />
        <TempInput label="T_H — Hot reservoir temperature" value={TH_val} setValue={setTHval} unit={TH_unit} setUnit={setTHunit} />
      </div>
      {valid && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <h4 className="font-sans text-sm font-semibold text-gray-700 dark:text-gray-200">T_C — Cold Reservoir Temperature</h4>
          <div className="grid grid-cols-3 gap-3">
            <ResultCard label="Kelvin" value={units.K} color="#3b82f6" />
            <ResultCard label="Celsius" value={units.C} color="#3b82f6" />
            <ResultCard label="Fahrenheit" value={units.F} color="#3b82f6" />
          </div>
          <Working lines={[
            `T_C = T_H × (1 - η)`,
            `T_C = ${T_H.toFixed(2)} × (1 - ${eta.toFixed(4)})`,
            `T_C = ${T_H.toFixed(2)} × ${(1 - eta).toFixed(4)}`,
            `T_C = ${T_C.toFixed(4)} K`,
          ]} />
        </motion.div>
      )}
    </div>
  )
}

function Tab3() {
  const [eta_val, setEtaVal] = useState('37.5')
  const [TC_val, setTCval] = useState('300')
  const [TC_unit, setTCunit] = useState('K')

  const eta = parseFloat(eta_val) / 100
  const T_C = toKelvin(TC_val, TC_unit)
  const valid = !isNaN(eta) && !isNaN(T_C) && eta > 0 && eta < 1 && T_C > 0

  const T_H = valid ? T_C / (1 - eta) : null
  const units = T_H ? allUnits(T_H) : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumInput label="η — Efficiency (%)" value={eta_val} setValue={setEtaVal} min={0.01} max={99.99} step={0.1} unit="%" />
        <TempInput label="T_C — Cold reservoir temperature" value={TC_val} setValue={setTCval} unit={TC_unit} setUnit={setTCunit} />
      </div>
      {valid && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <h4 className="font-sans text-sm font-semibold text-gray-700 dark:text-gray-200">T_H — Hot Reservoir Temperature</h4>
          <div className="grid grid-cols-3 gap-3">
            <ResultCard label="Kelvin" value={units.K} color="#ef4444" />
            <ResultCard label="Celsius" value={units.C} color="#ef4444" />
            <ResultCard label="Fahrenheit" value={units.F} color="#ef4444" />
          </div>
          <Working lines={[
            `T_H = T_C / (1 - η)`,
            `T_H = ${T_C.toFixed(2)} / (1 - ${eta.toFixed(4)})`,
            `T_H = ${T_C.toFixed(2)} / ${(1 - eta).toFixed(4)}`,
            `T_H = ${T_H.toFixed(4)} K`,
          ]} />
        </motion.div>
      )}
    </div>
  )
}

function Tab4() {
  const [TH_val, setTHval] = useState('800')
  const [TH_unit, setTHunit] = useState('K')
  const [TC_val, setTCval] = useState('300')
  const [TC_unit, setTCunit] = useState('K')
  const [n, setN] = useState('1')
  const [V1, setV1] = useState('1')
  const [V2, setV2] = useState('4')
  const [gamma, setGamma] = useState('1.4')

  const T_H = toKelvin(TH_val, TH_unit)
  const T_C = toKelvin(TC_val, TC_unit)
  const nv = parseFloat(n), V1v = parseFloat(V1), V2v = parseFloat(V2), gv = parseFloat(gamma)
  const valid = !isNaN(T_H) && !isNaN(T_C) && T_H > T_C && T_H > 0 && T_C > 0 && nv > 0 && V1v > 0 && V2v > V1v && gv > 1

  const results = useMemo(() => {
    if (!valid) return null
    const states = allStates(nv, T_H, T_C, V1v, V2v, gv)
    const { s1, s2, s3, s4 } = states
    const Q_H = heatAbsorbed(nv, T_H, V1v, V2v)
    const Q_C_raw = heatRejected(nv, T_C, s3.V, s4.V)
    const Q_C = Math.abs(Q_C_raw)
    const W = netWork(Q_H, Q_C)
    const eta = efficiency(T_H, T_C)
    const clausius = Q_H / T_H - Q_C / T_C
    const W12 = Q_H
    const W23 = nv * R * (T_H - T_C) / (gv - 1)
    const W34 = -nv * R * T_C * Math.log(s4.V / s3.V)
    const W41 = -nv * R * (T_H - T_C) / (gv - 1)
    return { states, Q_H, Q_C, W, eta, clausius, W12, W23, W34, W41, s1, s2, s3, s4 }
  }, [valid, T_H, T_C, nv, V1v, V2v, gv])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TempInput label="T_H" value={TH_val} setValue={setTHval} unit={TH_unit} setUnit={setTHunit} />
        <TempInput label="T_C" value={TC_val} setValue={setTCval} unit={TC_unit} setUnit={setTCunit} />
        <NumInput label="n — Moles" value={n} setValue={setN} min={0.01} max={10} step={0.1} unit="mol" />
        <NumInput label="V₁ — Initial volume" value={V1} setValue={setV1} min={0.01} max={10} step={0.1} unit="L" />
        <NumInput label="V₂ — Volume after isothermal exp." value={V2} setValue={setV2} min={0.1} max={50} step={0.1} unit="L" />
        <div className="space-y-1.5">
          <label className="font-sans text-xs font-medium text-gray-500 dark:text-gray-400">γ — Heat capacity ratio</label>
          <select value={gamma} onChange={e => setGamma(e.target.value)} className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-mono text-sm bg-white dark:bg-[#0f172a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="1.667">Monatomic (1.667)</option>
            <option value="1.4">Diatomic (1.4)</option>
          </select>
        </div>
      </div>

      {!valid && T_H <= T_C && (
        <div className="flex items-center gap-2 text-red-500 text-sm font-sans">
          <AlertCircle size={15} />
          <span>T_H must be greater than T_C</span>
        </div>
      )}

      {valid && results && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <h4 className="font-sans text-sm font-semibold text-gray-700 dark:text-gray-200">State Points</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['State', 'P (kPa)', 'V (L)', 'T (K)', 'T (°C)', 'T (°F)'].map(h => (
                    <th key={h} className="text-left py-2 pr-4 text-gray-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[results.s1, results.s2, results.s3, results.s4].map((s, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50">
                    <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                    <td className="py-2 pr-4 text-amber-600">{(s.P / 1000).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{s.V.toFixed(4)}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{s.T.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{(s.T - 273.15).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{((s.T - 273.15) * 9/5 + 32).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard label="η" value={`${(results.eta * 100).toFixed(4)}%`} color="#22c55e" />
            <ResultCard label="Q_H" value={`${results.Q_H.toFixed(2)} J`} color="#ef4444" />
            <ResultCard label="Q_C" value={`${results.Q_C.toFixed(2)} J`} color="#3b82f6" />
            <ResultCard label="W_net" value={`${results.W.toFixed(2)} J`} color="#eab308" />
            <ResultCard label="W (1→2)" value={`${results.W12.toFixed(2)} J`} color="#f97316" />
            <ResultCard label="W (2→3)" value={`${results.W23.toFixed(2)} J`} color="#a855f7" />
            <ResultCard label="W (3→4)" value={`${results.W34.toFixed(2)} J`} color="#3b82f6" />
            <ResultCard label="W (4→1)" value={`${results.W41.toFixed(2)} J`} color="#22c55e" />
          </div>

          <div className={`rounded-xl p-4 border ${Math.abs(results.clausius) < 1e-6 ? 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20' : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20'}`}>
            <p className="font-mono text-xs text-gray-600 dark:text-gray-300">
              Clausius: Q_H/T_H − Q_C/T_C = {results.clausius.toFixed(8)} J/K
            </p>
            <p className={`font-sans text-xs mt-1 font-semibold ${Math.abs(results.clausius) < 1e-6 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {Math.abs(results.clausius) < 1e-6 ? 'PASS — Entropy change equals zero. Cycle is perfectly reversible.' : 'FAIL — Check your parameters.'}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

const TABS = [
  { id: 'efficiency', label: 'Efficiency', component: Tab1 },
  { id: 'findTC', label: 'Find T_C', component: Tab2 },
  { id: 'findTH', label: 'Find T_H', component: Tab3 },
  { id: 'fullCycle', label: 'Full Cycle', component: Tab4 },
]

export default function MathModule() {
  const { darkMode, setDarkMode } = useApp()
  const [activeTab, setActiveTab] = useState('efficiency')
  const ActiveComp = TABS.find(t => t.id === activeTab)?.component

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
          <h1 className="font-serif text-2xl font-bold text-gray-900 dark:text-white">Thermodynamic Calculator</h1>
          <p className="font-sans text-xs text-gray-400 mt-0.5">Solve for any unknown in the Carnot cycle</p>
        </div>
        <button onClick={() => setDarkMode(!darkMode)} className="w-8 h-8 rounded-full bg-white dark:bg-[#1e293b] shadow-sm flex items-center justify-center text-gray-500 dark:text-gray-300 transition-colors">
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-[#1e293b] rounded-2xl p-1 mb-8">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-sans font-medium transition-all duration-200"
              style={{
                background: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? '#111827' : '#94a3b8',
                boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content card */}
        <div className="bg-white dark:bg-[#1e293b] rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {ActiveComp && <ActiveComp />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
