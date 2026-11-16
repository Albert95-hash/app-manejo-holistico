// Alertas (SPEC 4.7): AL-01 a AL-10. Cada función evalúa la condición de su alerta y,
// si se cumple, devuelve la alerta con el texto guía; si no, devuelve null.
// Las alertas se calculan, no se guardan.

import { EPS, formatearNumero as n } from './comunes'
import type { Alerta, Fecha } from './tipos'

/** AL-01 — Recuperación prevista insuficiente (PA-08): R_i(TR) < TR. */
export function alertaAL01(p: { potrero_id: string; nombre: string; recuperacion: number; tr: number }): Alerta | null {
  if (!(p.recuperacion < p.tr - EPS)) return null
  return {
    id: 'AL-01',
    nombre: 'Recuperación prevista insuficiente',
    texto: `Con este plan, ${p.nombre} descansa ${n(p.recuperacion)} días y necesita ${n(p.tr)}.`,
    potrero_id: p.potrero_id,
    datos: { recuperacion: p.recuperacion, tr: p.tr },
  }
}

/** AL-02 — Recuperación real insuficiente (RG-04): recuperación < TR exigido. */
export function alertaAL02(p: { potrero_id: string; nombre: string; recuperacion: number; tr_exigido: number }): Alerta | null {
  if (!(p.recuperacion < p.tr_exigido - EPS)) return null
  return {
    id: 'AL-02',
    nombre: 'Recuperación real insuficiente',
    texto: `${p.nombre} volvió a pastorearse a los ${n(p.recuperacion)} días; necesitaba ${n(p.tr_exigido)}.`,
    potrero_id: p.potrero_id,
    datos: { recuperacion: p.recuperacion, tr_exigido: p.tr_exigido },
  }
}

/** AL-03 — Déficit de pasto (PC-08 estado `deficit`). */
export function alertaAL03(p: { estado: string; balance: number; dias_cubiertos: number | null }): Alerta | null {
  if (p.estado !== 'deficit') return null
  const faltan = -p.balance
  const dias = p.dias_cubiertos === null ? '—' : n(p.dias_cubiertos, 1)
  return {
    id: 'AL-03',
    nombre: 'Déficit de pasto',
    texto: `Faltan ${n(faltan, 0)} raciones. El pasto alcanza para ${dias} días.`,
    datos: { faltan, dias_cubiertos: p.dias_cubiertos },
  }
}

/** AL-04 — Excedente de pasto (PC-08 estado `excedente`). */
export function alertaAL04(p: { estado: string; balance: number; utilizacion_pct: number | null }): Alerta | null {
  if (p.estado !== 'excedente') return null
  const uso = p.utilizacion_pct === null ? '—' : n(p.utilizacion_pct, 1)
  return {
    id: 'AL-04',
    nombre: 'Excedente de pasto',
    texto: `Sobran ${n(p.balance, 0)} raciones. Se usa el ${uso} % de la oferta.`,
    datos: { sobran: p.balance, utilizacion_pct: p.utilizacion_pct },
  }
}

/**
 * AL-05 — El redondeo excede los días (plan cerrado): suma de TP redondeados × selecciones
 * > dias_requeridos. `recortados` son los potreros recortados o que quedan sin entrar (CA-03).
 */
export function alertaAL05(p: {
  suma_tp_redondeados: number
  selecciones: number
  dias_requeridos: number
  recortados: string[]
}): Alerta | null {
  const total = p.suma_tp_redondeados * p.selecciones
  if (!(total > p.dias_requeridos + EPS)) return null
  return {
    id: 'AL-05',
    nombre: 'El redondeo excede los días',
    texto: `Los tiempos redondeados suman ${n(total)} días y el plan tiene ${n(p.dias_requeridos)}. Quedan recortados: ${p.recortados.join(', ')}.`,
    datos: { suma: total, dias_requeridos: p.dias_requeridos, recortados: p.recortados },
  }
}

/** Mediana de una lista (promedio de los dos centrales si la cantidad es par). */
export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null
  const v = [...valores].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return v.length % 2 === 1 ? v[m] : (v[m - 1] + v[m]) / 2
}

/**
 * AL-06 — Disponibilidad atípica: disp_i > factor × mediana de las disponibilidades mayores a 0
 * del plan (factor por defecto 3, Configuración). Devuelve una alerta por potrero atípico.
 */
export function alertasAL06(
  potreros: { potrero_id: string; nombre: string; disponibilidad: number }[],
  factor = 3,
): { mediana: number | null; umbral: number | null; alertas: Alerta[] } {
  const med = mediana(potreros.map((p) => p.disponibilidad).filter((d) => d > EPS))
  if (med === null) return { mediana: null, umbral: null, alertas: [] }
  const umbral = factor * med
  const alertas = potreros
    .filter((p) => p.disponibilidad > umbral + EPS)
    .map<Alerta>((p) => ({
      id: 'AL-06',
      nombre: 'Disponibilidad atípica',
      texto: `${p.nombre} tiene ${n(p.disponibilidad)} kg MS/ha, muy por encima del resto. Revisá el dato.`,
      potrero_id: p.potrero_id,
      datos: { disponibilidad: p.disponibilidad, mediana: med, umbral },
    }))
  return { mediana: med, umbral, alertas }
}

/** AL-07 — Estadía menor a un día: TP calculado < 1. */
export function alertaAL07(p: { potrero_id: string; nombre: string; tp_calculado: number; caso?: string }): Alerta | null {
  if (!(p.tp_calculado < 1 - EPS)) return null
  return {
    id: 'AL-07',
    nombre: 'Estadía menor a un día',
    texto: `${p.nombre} da para menos de un día.`,
    potrero_id: p.potrero_id,
    datos: { tp_calculado: p.tp_calculado, caso: p.caso ?? null },
  }
}

/** AL-08 — Sin crecimiento en plan abierto (PA-10 tasa `nula`). */
export function alertaAL08(tasa: string): Alerta | null {
  if (tasa !== 'nula') return null
  return {
    id: 'AL-08',
    nombre: 'Sin crecimiento en plan abierto',
    texto: 'Sin crecimiento: evaluá pasar al plan cerrado.',
    datos: {},
  }
}

/** AL-09 — Potrero bloqueado (CA-02, CA-03): se salteó por un evento que bloquea el pastoreo. */
export function alertaAL09(p: { potrero_id: string; nombre: string; fecha_desde: Fecha; fecha_hasta: Fecha }): Alerta {
  return {
    id: 'AL-09',
    nombre: 'Potrero bloqueado',
    texto: `${p.nombre} no está disponible del ${p.fecha_desde} al ${p.fecha_hasta}: se salteó.`,
    potrero_id: p.potrero_id,
    datos: { fecha_desde: p.fecha_desde, fecha_hasta: p.fecha_hasta },
  }
}

/** AL-10 — Cobertura no suma 100 (MO-06): |suma − 100| > tolerancia (por defecto 5). */
export function alertaAL10(suma: number, tolerancia = 5): Alerta | null {
  if (!(Math.abs(suma - 100) > tolerancia + EPS)) return null
  return {
    id: 'AL-10',
    nombre: 'Cobertura no suma 100',
    texto: `La muestra suma ${n(suma)} %.`,
    datos: { suma },
  }
}
