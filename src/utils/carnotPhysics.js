const R = 8.314

export const efficiency = (T_H, T_C) => 1 - T_C / T_H
export const heatAbsorbed = (n, T_H, V1, V2) => n * R * T_H * Math.log(V2 / V1)
export const heatRejected = (n, T_C, V3, V4) => n * R * T_C * Math.log(V3 / V4)
export const netWork = (Q_H, Q_C) => Q_H - Q_C
export const copR = (T_H, T_C) => T_C / (T_H - T_C)
export const copHP = (T_H, T_C) => T_H / (T_H - T_C)

export function allStates(n, T_H, T_C, V1, V2, gamma) {
  const V3 = V2 * Math.pow(T_H / T_C, 1 / (gamma - 1))
  const V4 = V1 * Math.pow(T_H / T_C, 1 / (gamma - 1))
  const P = (n, T, V) => (n * R * T) / (V * 1e-3)
  return {
    s1: { P: P(n, T_H, V1), V: V1, T: T_H },
    s2: { P: P(n, T_H, V2), V: V2, T: T_H },
    s3: { P: P(n, T_C, V3), V: V3, T: T_C },
    s4: { P: P(n, T_C, V4), V: V4, T: T_C },
  }
}

export function isothermPoints(n, T, Vstart, Vend, pts = 120) {
  return Array.from({ length: pts }, (_, i) => {
    const V = Vstart + (Vend - Vstart) * i / (pts - 1)
    return { V, P: (n * R * T) / (V * 1e-3) / 1000 }
  })
}

export function adiabaticPoints(P1_kPa, V1, gamma, Vend, pts = 120) {
  const C = P1_kPa * Math.pow(V1, gamma)
  return Array.from({ length: pts }, (_, i) => {
    const V = V1 + (Vend - V1) * i / (pts - 1)
    return { V, P: C / Math.pow(V, gamma) }
  })
}

export { R }
