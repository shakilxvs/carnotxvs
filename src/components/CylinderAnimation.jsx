import { useEffect, useRef, useState, useMemo } from 'react'
import { Lock } from 'lucide-react'

const PROCESS_INFO = [
  {
    label: '1 → 2',
    name: 'Isothermal Expansion',
    desc: 'Gas expands at constant temperature T_H, absorbing heat from the hot reservoir.',
    eq: 'PV = nRT_H = const',
    gasColor: '#fed7aa',
    heatType: 'hot',
    adiabatic: false,
    pistonDir: 'down',
  },
  {
    label: '2 → 3',
    name: 'Adiabatic Expansion',
    desc: 'Gas continues expanding with no heat exchange — temperature falls from T_H to T_C.',
    eq: 'PV^γ = const, Q = 0',
    gasColor: '#c7d2fe',
    heatType: 'none',
    adiabatic: true,
    pistonDir: 'down',
  },
  {
    label: '3 → 4',
    name: 'Isothermal Compression',
    desc: 'Gas is compressed at constant temperature T_C, rejecting heat to the cold reservoir.',
    eq: 'PV = nRT_C = const',
    gasColor: '#bfdbfe',
    heatType: 'cold',
    adiabatic: false,
    pistonDir: 'up',
  },
  {
    label: '4 → 1',
    name: 'Adiabatic Compression',
    desc: 'Gas is compressed with no heat exchange — temperature rises from T_C back to T_H.',
    eq: 'PV^γ = const, Q = 0',
    gasColor: '#fed7aa',
    heatType: 'none',
    adiabatic: true,
    pistonDir: 'up',
  },
]

function Molecule({ x, y, speed }) {
  const ref = useRef(null)
  const vx = useRef((Math.random() - 0.5) * speed)
  const vy = useRef((Math.random() - 0.5) * speed)
  const pos = useRef({ x, y })
  const raf = useRef(null)
  const bounds = { minX: 5, maxX: 135, minY: 5, maxY: 195 }

  useEffect(() => {
    vx.current = (Math.random() - 0.5) * speed * 2
    vy.current = (Math.random() - 0.5) * speed * 2
  }, [speed])

  useEffect(() => {
    const animate = () => {
      pos.current.x += vx.current
      pos.current.y += vy.current
      if (pos.current.x < bounds.minX || pos.current.x > bounds.maxX) vx.current *= -1
      if (pos.current.y < bounds.minY || pos.current.y > bounds.maxY) vy.current *= -1
      if (ref.current) {
        ref.current.setAttribute('cx', pos.current.x)
        ref.current.setAttribute('cy', pos.current.y)
      }
      raf.current = requestAnimationFrame(animate)
    }
    raf.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  return <circle ref={ref} cx={x} cy={y} r="3" fill="white" opacity="0.7" />
}

export default function CylinderAnimation({ processIdx, T_H = 800, T_C = 300 }) {
  const proc = PROCESS_INFO[processIdx]
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 50)
    return () => clearInterval(id)
  }, [])

  // Piston position: 0 = top (compressed), 1 = bottom (expanded)
  const pistonPositions = [0.25, 0.75, 0.75, 0.25]
  const pistonY_start = pistonPositions[processIdx] * 160 + 20
  const pistonY_end = pistonPositions[(processIdx + 1) % 4] * 160 + 20

  const elapsed = (tick % 60) / 60
  const pistonY = pistonY_start + (pistonY_end - pistonY_start) * elapsed

  const gasHeight = 200 - pistonY
  const gasY = pistonY

  const T_current = processIdx === 0 || processIdx === 1
    ? T_H - (T_H - T_C) * (processIdx === 1 ? elapsed : 0)
    : T_C + (T_H - T_C) * (processIdx === 3 ? elapsed : 0)

  const speed = Math.sqrt(T_current / 300) * 1.5

  const molecules = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 120,
    y: 10 + Math.random() * 170,
  })), [])

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="180" height="280" viewBox="0 0 180 280" className="overflow-visible">
        {/* Hot arrow */}
        {proc.heatType === 'hot' && (
          <g>
            <defs>
              <marker id="arrowOrange" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#f97316" />
              </marker>
            </defs>
            <line x1="90" y1="260" x2="90" y2="242" stroke="#f97316" strokeWidth="2.5" markerEnd="url(#arrowOrange)" strokeDasharray="4,2">
              <animate attributeName="y1" values="268;255" dur="1s" repeatCount="indefinite" />
            </line>
            <text x="90" y="275" textAnchor="middle" fill="#f97316" fontSize="10" fontFamily="JetBrains Mono, monospace">Q_H in</text>
          </g>
        )}

        {/* Cold arrow */}
        {proc.heatType === 'cold' && (
          <g>
            <defs>
              <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#3b82f6" />
              </marker>
            </defs>
            <line x1="90" y1="242" x2="90" y2="260" stroke="#3b82f6" strokeWidth="2.5" markerEnd="url(#arrowBlue)" strokeDasharray="4,2">
              <animate attributeName="y2" values="252;265" dur="1s" repeatCount="indefinite" />
            </line>
            <text x="90" y="275" textAnchor="middle" fill="#3b82f6" fontSize="10" fontFamily="JetBrains Mono, monospace">Q_C out</text>
          </g>
        )}

        {/* Cylinder body */}
        <rect x="20" y="20" width="140" height="220" rx="6" fill="#f8fafc" stroke="#334155" strokeWidth="2.5" />

        {/* Gas region */}
        <rect
          x="22"
          y={gasY + 1}
          width="136"
          height={Math.max(0, gasHeight - 2)}
          rx="0"
          fill={proc.gasColor}
          opacity="0.85"
        />

        {/* Molecules clipped to gas region */}
        <clipPath id="gasClip">
          <rect x="22" y={gasY} width="136" height={Math.max(0, gasHeight)} />
        </clipPath>
        <g clipPath="url(#gasClip)">
          <g transform={`translate(22, ${gasY})`}>
            {molecules.map(m => (
              <Molecule key={m.id} x={m.x} y={m.y} speed={speed} />
            ))}
          </g>
        </g>

        {/* Piston */}
        <rect x="18" y={pistonY - 8} width="144" height="16" rx="4" fill="#475569" stroke="#1e293b" strokeWidth="1.5" />
        {/* Piston rod */}
        <rect x="82" y={Math.max(5, pistonY - 30)} width="16" height="26" rx="3" fill="#64748b" />

        {/* Work arrow during expansion */}
        {(processIdx === 0 || processIdx === 1) && (
          <g>
            <defs>
              <marker id="arrowGold" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#eab308" />
              </marker>
            </defs>
            <line x1="168" y1={pistonY} x2="178" y2={pistonY} stroke="#eab308" strokeWidth="2" markerEnd="url(#arrowGold)" />
            <text x="170" y={pistonY - 5} fill="#eab308" fontSize="9" fontFamily="JetBrains Mono, monospace">W</text>
          </g>
        )}

        {/* Adiabatic indicator */}
        {proc.adiabatic && (
          <g>
            <rect x="55" y="5" width="70" height="18" rx="9" fill="#7c3aed" opacity="0.9" />
            <text x="90" y="17" textAnchor="middle" fill="white" fontSize="9" fontFamily="DM Sans, sans-serif" fontWeight="600">ADIABATIC</text>
          </g>
        )}

        {/* Cylinder rim */}
        <rect x="10" y="16" width="160" height="12" rx="4" fill="#94a3b8" />
        {/* Left column */}
        <rect x="10" y="16" width="12" height="224" rx="2" fill="#94a3b8" />
        {/* Right column */}
        <rect x="158" y="16" width="12" height="224" rx="2" fill="#94a3b8" />
      </svg>

      {/* Process label */}
      <div className="text-center max-w-[240px] space-y-1">
        <p className="font-sans font-semibold text-sm text-gray-800 dark:text-white">{proc.name}</p>
        <p className="font-sans text-xs text-gray-500 dark:text-gray-400 leading-snug">{proc.desc}</p>
        <code className="font-mono text-xs text-amber-600 dark:text-amber-400">{proc.eq}</code>
      </div>
    </div>
  )
}
