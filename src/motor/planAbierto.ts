// Plan abierto (SPEC 4.2): PA-01 a PA-11.

import { alertaAL01, alertaAL07, alertaAL08 } from './alertas'
import { EPS, ErrorValidacion, diaAFecha, fechaADia, instanteAMedios, redondearTP } from './comunes'
import type { Alerta, Fecha, Instante, ModoRecuperacion, TasaCrecimiento, TramoEntrada } from './tipos'

/** PA-01 — Calidad ponderada: CP_i = sup_i × cal_i. */
export function calidadPonderada(superficieHa: number, calidad: number): number {
  return superficieHa * calidad
}

/** PA-02 — Cantidad de potreros incluidos. Se calcula, nunca se tipea. Debe ser n ≥ 2. */
export function cantidadPotreros(potreros: unknown[]): number {
  const n = potreros.length
  if (n < 2) throw new ErrorValidacion('se necesitan al menos 2 potreros')
  return n
}

/** PA-03 — Calidad ponderada promedio: CPm = Σ CP_i / n. */
export function calidadPonderadaPromedio(cps: number[]): number {
  return cps.reduce((s, x) => s + x, 0) / cps.length
}

/** PA-04 — Factor relativo: f_i = CP_i / CPm. */
export function factorRelativo(cp: number, cpm: number): number {
  return cp / cpm
}

/**
 * PA-05 — Período de pastoreo promedio.
 * Modo `curso`: PP(TR) = TR / (n − 1). Modo `garantizada`: PP(TR) = TR / (n − f_max).
 */
export function periodoPastoreoPromedio(tr: number, n: number, fMax: number, modo: ModoRecuperacion): number {
  const divisor = modo === 'curso' ? n - 1 : n - fMax
  if (divisor <= EPS) {
    throw new ErrorValidacion('no se puede calcular el período de pastoreo: un solo potrero concentra toda la calidad')
  }
  return tr / divisor
}

/** PA-06 — Tiempo de pastoreo del potrero: f_i × PP(TR); el valor manual reemplaza al calculado. */
export function tiempoPastoreoPotrero(f: number, pp: number, manual?: number | null): number {
  return manual ?? f * pp
}

/** PA-07 — Duración de la vuelta: V(TR) = Σ TP_i(TR). */
export function duracionVuelta(tps: number[]): number {
  return tps.reduce((s, x) => s + x, 0)
}

/** PA-08 — Recuperación prevista: R_i(TR) = V(TR) − TP_i(TR). */
export function recuperacionPrevista(vuelta: number, tp: number): number {
  return vuelta - tp
}

export interface IndicadoresReferencia {
  tp_total: number
  sin_animales: number
  /** Fracción (0 a 1). */
  pct_pastoreo: number
}

/**
 * PA-09 — Indicadores de referencia del curso, con TP sin redondear:
 * TPtot = TPmin + TPmax; sin_animales = dias_plan − TPtot; pct_pastoreo = TPtot / dias_plan.
 */
export function indicadoresReferencia(tpMinCalculado: number, tpMaxCalculado: number, diasDelPlan: number): IndicadoresReferencia {
  const tp_total = tpMinCalculado + tpMaxCalculado
  return { tp_total, sin_animales: diasDelPlan - tp_total, pct_pastoreo: tp_total / diasDelPlan }
}

/** PA-10 — Tasa vigente en una fecha: la del último tramo con fecha_desde ≤ fecha; sin tramos, `rapida`. */
export function tasaVigente(tramos: TramoEntrada[], fecha: Fecha): TasaCrecimiento {
  let vigente: TramoEntrada | null = null
  for (const t of tramos) {
    if (t.fecha_desde <= fecha && (vigente === null || t.fecha_desde >= vigente.fecha_desde)) vigente = t
  }
  return vigente ? vigente.tasa : 'rapida'
}

/** PA-10 — TR vigente según la tasa: `rapida` → TRmin; `lenta` y `nula` → TRmax. */
export function trVigente(tasa: TasaCrecimiento, trMin: number, trMax: number): number {
  return tasa === 'rapida' ? trMin : trMax
}

/** PA-10 — TP que se usa según la tasa: `rapida` → TPmin; `lenta` y `nula` → TPmax (`nula` con AL-08). */
export function tpVigente(tasa: TasaCrecimiento, tpMin: number, tpMax: number): { tp: number; alerta: Alerta | null } {
  return { tp: tasa === 'rapida' ? tpMin : tpMax, alerta: alertaAL08(tasa) }
}

/**
 * PA-11 — TR exigido a un descanso: el mayor TR vigente entre las tasas que rigieron en algún
 * día del intervalo [desde, hasta). Si el intervalo es vacío se usa el día de `desde`.
 */
export function trExigido(tramos: TramoEntrada[], desde: Instante, hasta: Instante, trMin: number, trMax: number): number {
  const primerDia = fechaADia(desde.fecha)
  // Último día con alguna parte dentro del intervalo: el medio día anterior a `hasta`.
  const ultimoDia = Math.max(primerDia, Math.floor((instanteAMedios(hasta) - 1) / 2))
  let tr = trVigente(tasaVigente(tramos, desde.fecha), trMin, trMax)
  for (const t of tramos) {
    const d = fechaADia(t.fecha_desde)
    if (d > primerDia && d <= ultimoDia) {
      // La tasa de ese día puede no ser la de este tramo si otro empieza el mismo día.
      tr = Math.max(tr, trVigente(tasaVigente(tramos, diaAFecha(d)), trMin, trMax))
    }
  }
  return tr
}

// ---------- Cálculo completo del plan ----------

export interface PotreroAbiertoEntrada {
  potrero_id: string
  nombre: string
  /** CA-01. */
  orden: number
  superficie_ha: number
  /** 1 a 10. */
  calidad: number
  tp_min_manual?: number | null
  tp_max_manual?: number | null
}

export interface PlanAbiertoEntrada {
  /** Solo los potreros incluidos. */
  potreros: PotreroAbiertoEntrada[]
  tr_min: number
  tr_max: number
  /** Por defecto `garantizada`. */
  modo?: ModoRecuperacion
  /** Si se indica, se calculan los indicadores de referencia (PA-09). */
  dias_plan?: number
}

export interface FilaPlanAbierto {
  potrero_id: string
  nombre: string
  orden: number
  superficie_ha: number
  calidad: number
  /** PA-01. */
  cp: number
  /** PA-04. */
  f: number
  /** PA-06, sin redondear (el manual reemplaza al calculado). */
  tp_min_calculado: number
  tp_max_calculado: number
  tp_min_es_manual: boolean
  tp_max_es_manual: boolean
  /** PA-06 + CM-09. */
  tp_min: number
  tp_max: number
  /** PA-08, con valores redondeados. */
  recuperacion_min: number
  recuperacion_max: number
  /** PA-08, sin redondear. */
  recuperacion_min_calculada: number
  recuperacion_max_calculada: number
  /** PA-09. Nulo si no se indicó dias_plan. */
  referencia: IndicadoresReferencia | null
}

export interface ResultadoPlanAbierto {
  modo: ModoRecuperacion
  /** PA-02. */
  n: number
  suma_cp: number
  /** PA-03. */
  cpm: number
  /** PA-04. */
  f_max: number
  /** PA-05. */
  pp_min: number
  pp_max: number
  /** PA-07. */
  vuelta_min_calculada: number
  vuelta_min_redondeada: number
  vuelta_max_calculada: number
  vuelta_max_redondeada: number
  /** Ordenadas por `orden` (CA-01). */
  filas: FilaPlanAbierto[]
  /** AL-01 y AL-07. */
  alertas: Alerta[]
}

/** PA-01 a PA-09 — Cálculo completo de la tabla del plan abierto, con AL-01 y AL-07. */
export function calcularPlanAbierto(entrada: PlanAbiertoEntrada): ResultadoPlanAbierto {
  const modo = entrada.modo ?? 'garantizada'
  const potreros = [...entrada.potreros].sort((a, b) => a.orden - b.orden)
  const n = cantidadPotreros(potreros)
  if (entrada.tr_min > entrada.tr_max) throw new ErrorValidacion('el TR mínimo no puede superar al TR máximo')

  const cps = potreros.map((p) => calidadPonderada(p.superficie_ha, p.calidad))
  const suma_cp = cps.reduce((s, x) => s + x, 0)
  const cpm = calidadPonderadaPromedio(cps)
  if (cpm <= EPS) throw new ErrorValidacion('la calidad ponderada de los potreros es 0')
  const fs = cps.map((cp) => factorRelativo(cp, cpm))
  const f_max = Math.max(...fs)
  const pp_min = periodoPastoreoPromedio(entrada.tr_min, n, f_max, modo)
  const pp_max = periodoPastoreoPromedio(entrada.tr_max, n, f_max, modo)

  const tpMinCalc = potreros.map((p, i) => tiempoPastoreoPotrero(fs[i], pp_min, p.tp_min_manual))
  const tpMaxCalc = potreros.map((p, i) => tiempoPastoreoPotrero(fs[i], pp_max, p.tp_max_manual))
  const tpMin = tpMinCalc.map(redondearTP)
  const tpMax = tpMaxCalc.map(redondearTP)

  const vuelta_min_calculada = duracionVuelta(tpMinCalc)
  const vuelta_max_calculada = duracionVuelta(tpMaxCalc)
  const vuelta_min_redondeada = duracionVuelta(tpMin)
  const vuelta_max_redondeada = duracionVuelta(tpMax)

  const alertas: Alerta[] = []
  const filas = potreros.map<FilaPlanAbierto>((p, i) => {
    const fila: FilaPlanAbierto = {
      potrero_id: p.potrero_id,
      nombre: p.nombre,
      orden: p.orden,
      superficie_ha: p.superficie_ha,
      calidad: p.calidad,
      cp: cps[i],
      f: fs[i],
      tp_min_calculado: tpMinCalc[i],
      tp_max_calculado: tpMaxCalc[i],
      tp_min_es_manual: p.tp_min_manual != null,
      tp_max_es_manual: p.tp_max_manual != null,
      tp_min: tpMin[i],
      tp_max: tpMax[i],
      recuperacion_min: recuperacionPrevista(vuelta_min_redondeada, tpMin[i]),
      recuperacion_max: recuperacionPrevista(vuelta_max_redondeada, tpMax[i]),
      recuperacion_min_calculada: recuperacionPrevista(vuelta_min_calculada, tpMinCalc[i]),
      recuperacion_max_calculada: recuperacionPrevista(vuelta_max_calculada, tpMaxCalc[i]),
      referencia:
        entrada.dias_plan != null ? indicadoresReferencia(tpMinCalc[i], tpMaxCalc[i], entrada.dias_plan) : null,
    }
    const casos = [
      { caso: 'min', tr: entrada.tr_min, r: fila.recuperacion_min, tp: fila.tp_min_calculado },
      { caso: 'max', tr: entrada.tr_max, r: fila.recuperacion_max, tp: fila.tp_max_calculado },
    ]
    for (const c of casos) {
      const al01 = alertaAL01({ potrero_id: p.potrero_id, nombre: p.nombre, recuperacion: c.r, tr: c.tr })
      if (al01) alertas.push({ ...al01, datos: { ...al01.datos, caso: c.caso } })
      const al07 = alertaAL07({ potrero_id: p.potrero_id, nombre: p.nombre, tp_calculado: c.tp, caso: c.caso })
      if (al07) alertas.push(al07)
    }
    return fila
  })

  return {
    modo,
    n,
    suma_cp,
    cpm,
    f_max,
    pp_min,
    pp_max,
    vuelta_min_calculada,
    vuelta_min_redondeada,
    vuelta_max_calculada,
    vuelta_max_redondeada,
    filas,
    alertas,
  }
}
