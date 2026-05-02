import { useMemo, useState, useEffect } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceDot, ReferenceArea
} from 'recharts'
import { allStates, isothermPoints, adiabaticPoints } from '../utils/carnotPhysics'

const COLORS = {
  p12: '#f97316',
  p23: '#a855f7',
  p34: '#3b82f6',
  p41: '#22c55e',
}

export default function PVDiagram({ processIdx, n, T_H, T_C, V1, V2, gamma }) {
  const [dotProgress, setDotProgress] = useState(0)

  useEffect(() => {
    let start = null
    const duration = 2000
    const animate = (ts) => {
      if (!start) start = ts
      const t = Math.min((ts - start) / duration, 1)
      setDotProgress(t)
      if (t < 1) requestAnimationFrame(animate)
    }
    setDotProgress(0)
    const raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [processIdx])

  const states = useMemo(() => {
    try {
      return allStates(n, T_H, T_C, V1, V2, gamma)
    } catch { return null }
  }, [n, T_H, T_C, V1, V2, gamma])

  const curves = useMemo(() => {
    if (!states) return {}
    const { s1, s2, s3, s4 } = states
    const p12 = isothermPoints(n, T_H, V1, V2)
    const p23 = adiabaticPoints(s2.P / 1000, V2, gamma, s3.V)
    const p34 = isothermPoints(n, T_C, s3.V, s4.V)
    const p41 = adiabaticPoints(s4.P / 1000, s4.V, gamma, V1)
    return { p12, p23, p34, p41 }
  }, [states, n, T_H, T_C, V1, V2, gamma])

  if (!states || !curves.p12) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 font-sans text-sm">
        Invalid parameters (T_H must be greater than T_C)
      </div>
    )
  }

  const { s1, s2, s3, s4 } = states
  const allPts = [...curves.p12, ...curves.p23, ...curves.p34, ...curves.p41]
  const maxP = Math.max(...allPts.map(p => p.P)) * 1.1
  const maxV = Math.max(...allPts.map(p => p.V)) * 1.1
  const minV = Math.min(...allPts.map(p => p.V)) * 0.9

  // Traveling dot
  const currentCurve = [curves.p12, curves.p23, curves.p34, curves.p41][processIdx]
  const dotIdx = Math.floor(dotProgress * (currentCurve.length - 1))
  const dotPt = currentCurve[dotIdx] || currentCurve[0]

  // Build shaded area data (merge all curves)
  const shadedArea = [
    ...curves.p12,
    ...curves.p23,
    ...curves.p34.slice().reverse(),
    ...curves.p41.slice().reverse(),
  ]

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="V"
            type="number"
            domain={[minV * 0.9, maxV]}
            label={{ value: 'Volume (L)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94a3b8', fontFamily: 'DM Sans' }}
            tickFormatter={v => v.toFixed(1)}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            allowDataOverflow
          />
          <YAxis
            dataKey="P"
            type="number"
            domain={[0, maxP]}
            label={{ value: 'P (kPa)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fill: '#94a3b8', fontFamily: 'DM Sans' }}
            tickFormatter={v => v.toFixed(0)}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            allowDataOverflow
          />
          <Tooltip
            formatter={(v, name) => [v.toFixed(2), name]}
            contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />

          {/* Curves */}
          <Line data={curves.p12} dataKey="P" dot={false} stroke={COLORS.p12} strokeWidth={processIdx === 0 ? 3 : 1.5} strokeOpacity={processIdx === 0 ? 1 : 0.5} name="1→2" isAnimationActive={false} />
          <Line data={curves.p23} dataKey="P" dot={false} stroke={COLORS.p23} strokeWidth={processIdx === 1 ? 3 : 1.5} strokeOpacity={processIdx === 1 ? 1 : 0.5} name="2→3" isAnimationActive={false} />
          <Line data={curves.p34} dataKey="P" dot={false} stroke={COLORS.p34} strokeWidth={processIdx === 2 ? 3 : 1.5} strokeOpacity={processIdx === 2 ? 1 : 0.5} name="3→4" isAnimationActive={false} />
          <Line data={curves.p41} dataKey="P" dot={false} stroke={COLORS.p41} strokeWidth={processIdx === 3 ? 3 : 1.5} strokeOpacity={processIdx === 3 ? 1 : 0.5} name="4→1" isAnimationActive={false} />

          {/* State point labels */}
          <ReferenceDot x={s1.V} y={s1.P / 1000} r={5} fill="#111827" stroke="white" strokeWidth={2} label={{ value: '1', position: 'top', fill: '#111827', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
          <ReferenceDot x={s2.V} y={s2.P / 1000} r={5} fill="#111827" stroke="white" strokeWidth={2} label={{ value: '2', position: 'top', fill: '#111827', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
          <ReferenceDot x={s3.V} y={s3.P / 1000} r={5} fill="#111827" stroke="white" strokeWidth={2} label={{ value: '3', position: 'bottom', fill: '#111827', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
          <ReferenceDot x={s4.V} y={s4.P / 1000} r={5} fill="#111827" stroke="white" strokeWidth={2} label={{ value: '4', position: 'bottom', fill: '#111827', fontSize: 11, fontFamily: 'JetBrains Mono' }} />

          {/* Traveling dot */}
          <ReferenceDot x={dotPt.V} y={dotPt.P} r={7} fill="white" stroke={Object.values(COLORS)[processIdx]} strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        {[
          { label: '1→2 Isothermal (T_H)', color: COLORS.p12 },
          { label: '2→3 Adiabatic', color: COLORS.p23 },
          { label: '3→4 Isothermal (T_C)', color: COLORS.p34 },
          { label: '4→1 Adiabatic', color: COLORS.p41 },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded" style={{ background: l.color }} />
            <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
