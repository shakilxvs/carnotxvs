export function toDisplay(K, unit, dp = 2) {
  const v = unit === 'C' ? K - 273.15 : unit === 'F' ? (K - 273.15) * 9/5 + 32 : K
  const s = unit === 'C' ? ' °C' : unit === 'F' ? ' °F' : ' K'
  return v.toFixed(dp) + s
}

export function toKelvin(val, unit) {
  const v = parseFloat(val)
  if (isNaN(v)) return NaN
  if (unit === 'C') return v + 273.15
  if (unit === 'F') return (v - 32) * 5/9 + 273.15
  return v
}

export function allUnits(K) {
  return {
    K: K.toFixed(2) + ' K',
    C: (K - 273.15).toFixed(2) + ' °C',
    F: ((K - 273.15) * 9/5 + 32).toFixed(2) + ' °F',
  }
}
