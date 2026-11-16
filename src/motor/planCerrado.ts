// Plan cerrado (SPEC 4.3): PC-01 a PC-11.

import { alertaAL03, alertaAL04, alertaAL05, alertaAL07, alertasAL06 } from './alertas'
import { EPS, ErrorValidacion, evRodeoEnFecha, mesesPlan, redondearTP, type FilaComposicion } from './comunes'
import type { Alerta, Fecha } from './tipos'

/** PC-01 — Forraje del potrero: F_i = sup_i × disp_i (kg MS). */
export function forrajePotrero(superficieHa: number, disponibilidad: number): number {
  return superficieHa * disponibilidad
}

/** PC-02 — Raciones por hectárea: DAha_i = disp_i / a (DA/ha). */
export function racionesPorHa(disponibilidad: number, asignacion: number): number {
  return disponibilidad / asignacion
}

/** PC-03 — Raciones totales del potrero: DAT_i = F_i / a (DA). */
export function racionesTotales(forraje: number, asignacion: number): number {
  return forraje / asignacion
}

/** PC-05 — Días requeridos: dias_plan + dias_reserva. */
export function diasRequeridos(diasDelPlan: number, diasReserva: number): number {
  return diasDelPlan + diasReserva
}

/**
 * PC-06 — Tiempo de pastoreo: TP_i = (DAT_i / oferta) × dias_requeridos; TPsel_i = TP_i / s.
 * El valor manual reemplaza a TPsel_i.
 */
export function tiempoPastoreoCerrado(
  dat: number,
  oferta: number,
  diasReq: number,
  selecciones: number,
  manual?: number | null,
): { tp_total: number; tp_sel: number } {
  const tp_total = oferta > EPS ? (dat / oferta) * diasReq : 0
  return { tp_total, tp_sel: manual ?? tp_total / selecciones }
}

export interface MesDemanda {
  mes: string
  dias: number
  ev: number
  demanda: number
}

export interface ResultadoDemanda {
  meses: MesDemanda[]
  ev_ultimo_mes: number
  demanda_reserva: number
  demanda: number
}

/**
 * PC-07 — Demanda: Σ_meses (ev_mes × dias_mes) + ev_ultimo_mes × dias_reserva (DA).
 * Los meses salen de CM-02 y el EV de cada mes de CM-06.
 */
export function demandaPlan(
  fechaInicio: Fecha,
  fechaFin: Fecha,
  composicion: FilaComposicion[],
  diasReserva = 0,
): ResultadoDemanda {
  const meses = mesesPlan(fechaInicio, fechaFin).map<MesDemanda>((m) => {
    const ev = evRodeoEnFecha(composicion, `${m.mes}-01`, fechaFin).ev
    return { mes: m.mes, dias: m.dias, ev, demanda: ev * m.dias }
  })
  const ev_ultimo_mes = meses[meses.length - 1].ev
  const demanda_reserva = ev_ultimo_mes * diasReserva
  return {
    meses,
    ev_ultimo_mes,
    demanda_reserva,
    demanda: meses.reduce((s, m) => s + m.demanda, 0) + demanda_reserva,
  }
}

export type EstadoBalance = 'sin_demanda' | 'deficit' | 'excedente' | 'equilibrado'

export interface ResultadoBalance {
  /** PC-08. */
  balance: number
  /** PC-08. Nulo si la oferta es 0. */
  utilizacion_pct: number | null
  estado: EstadoBalance
  /** PC-09 (EV). */
  receptividad: number
  /** PC-10 (EV). */
  ev_promedio: number
  /** PC-10 (días). Nulo si no hay demanda. */
  dias_cubiertos: number | null
  /** AL-03 o AL-04. */
  alertas: Alerta[]
}

/** PC-08 — Estado del balance según la tolerancia (%, por defecto 5). */
export function estadoBalance(oferta: number, demanda: number, toleranciaPct = 5): EstadoBalance {
  if (Math.abs(demanda) <= EPS) return 'sin_demanda'
  const balance = oferta - demanda
  const margen = (toleranciaPct * demanda) / 100
  if (balance < -margen - EPS) return 'deficit'
  if (balance > margen + EPS) return 'excedente'
  return 'equilibrado'
}

/** PC-09 — Receptividad: oferta / dias_requeridos (EV). */
export function receptividad(oferta: number, diasReq: number): number {
  return oferta / diasReq
}

/** PC-10 — Días cubiertos: oferta / (demanda / dias_requeridos). */
export function diasCubiertos(oferta: number, demanda: number, diasReq: number): number | null {
  const evPromedio = demanda / diasReq
  return evPromedio > EPS ? oferta / evPromedio : null
}

/** PC-08 a PC-10 — Balance forrajero completo, con AL-03 y AL-04. */
export function balanceForrajero(p: {
  oferta: number
  demanda: number
  dias_requeridos: number
  tolerancia_balance_pct?: number
}): ResultadoBalance {
  const balance = p.oferta - p.demanda
  const estado = estadoBalance(p.oferta, p.demanda, p.tolerancia_balance_pct ?? 5)
  const utilizacion_pct = p.oferta > EPS ? (p.demanda / p.oferta) * 100 : null
  const dias_cubiertos = diasCubiertos(p.oferta, p.demanda, p.dias_requeridos)
  const alertas: Alerta[] = []
  const al03 = alertaAL03({ estado, balance, dias_cubiertos })
  if (al03) alertas.push(al03)
  const al04 = alertaAL04({ estado, balance, utilizacion_pct })
  if (al04) alertas.push(al04)
  return {
    balance,
    utilizacion_pct,
    estado,
    receptividad: receptividad(p.oferta, p.dias_requeridos),
    ev_promedio: p.demanda / p.dias_requeridos,
    dias_cubiertos,
    alertas,
  }
}

export interface DemandaPlaneada {
  /** Una entrada por período planificado (selección). */
  periodos: { demanda: number; demanda_da_ha: number }[]
  demanda_total: number
  /** Nulo si DAT = 0. */
  utilizacion_pct: number | null
}

/**
 * PC-11 — Demanda planeada por potrero: demanda_i = ev_rodeo(fecha_entrada) × duracion_dias;
 * demanda_DAha_i = demanda_i / sup_i; utilizacion_i = Σ demanda_i / DAT_i × 100.
 */
export function demandaPlaneadaPotrero(p: {
  periodos: { fecha_entrada: Fecha; duracion_dias: number }[]
  /** CM-06. */
  ev_en_fecha: (fecha: Fecha) => number
  superficie_ha: number
  dat: number
}): DemandaPlaneada {
  const periodos = p.periodos.map((per) => {
    const demanda = p.ev_en_fecha(per.fecha_entrada) * per.duracion_dias
    return { demanda, demanda_da_ha: demanda / p.superficie_ha }
  })
  const demanda_total = periodos.reduce((s, x) => s + x.demanda, 0)
  return { periodos, demanda_total, utilizacion_pct: p.dat > EPS ? (demanda_total / p.dat) * 100 : null }
}

// ---------- Cálculo completo del plan ----------

export interface PotreroCerradoEntrada {
  potrero_id: string
  nombre: string
  /** CA-01. */
  orden: number
  superficie_ha: number
  /** kg MS/ha. Vacía = 0. */
  disponibilidad?: number | null
  /** Por selección. */
  tp_manual?: number | null
}

export interface PlanCerradoEntrada {
  /** Solo los potreros incluidos. */
  potreros: PotreroCerradoEntrada[]
  /** kg MS/DA. Por defecto 20. */
  asignacion?: number
  /** 1 a 3. Por defecto 1. */
  selecciones?: number
  dias_plan: number
  dias_reserva?: number
  /** AL-06. Por defecto 3. */
  factor_disponibilidad_atipica?: number
}

export interface FilaPlanCerrado {
  potrero_id: string
  nombre: string
  orden: number
  superficie_ha: number
  disponibilidad: number
  /** PC-01. */
  forraje: number
  /** PC-02. */
  da_ha: number
  /** PC-03. */
  dat: number
  /** PC-06, sin redondear. */
  tp_total: number
  tp_sel_calculado: number
  tp_es_manual: boolean
  /** PC-06 + CM-09. */
  tp_sel: number
  /** Falso si DAT = 0: queda fuera de la secuencia. */
  en_secuencia: boolean
  /** "sin pasto cargado" si DAT = 0. */
  aviso: string | null
}

export interface ResultadoPlanCerrado {
  asignacion: number
  selecciones: number
  /** PC-05. */
  dias_requeridos: number
  suma_forraje: number
  /** PC-04. */
  oferta: number
  suma_superficie: number
  n: number
  da_ha_campo: number
  disp_campo: number
  /** PC-09. */
  receptividad: number
  /** Σ TP_i sin redondear (= dias_requeridos sin valores manuales). */
  suma_tp_total: number
  suma_tp_sel_calculado: number
  suma_tp_sel_redondeado: number
  /** Ordenadas por `orden` (CA-01). */
  filas: FilaPlanCerrado[]
  /** AL-05, AL-06 y AL-07. */
  alertas: Alerta[]
}

export const AVISO_SIN_PASTO = 'sin pasto cargado'

/** PC-01 a PC-06 y PC-09 — Cálculo completo de la tabla del plan cerrado, con AL-05, AL-06 y AL-07. */
export function calcularPlanCerrado(entrada: PlanCerradoEntrada): ResultadoPlanCerrado {
  const asignacion = entrada.asignacion ?? 20
  const selecciones = entrada.selecciones ?? 1
  if (!(asignacion > 0)) throw new ErrorValidacion('la asignación debe ser mayor a 0')
  if (!Number.isInteger(selecciones) || selecciones < 1 || selecciones > 3) {
    throw new ErrorValidacion('las selecciones deben ser 1, 2 o 3')
  }
  const dias_requeridos = diasRequeridos(entrada.dias_plan, entrada.dias_reserva ?? 0)
  const potreros = [...entrada.potreros].sort((a, b) => a.orden - b.orden)

  const base = potreros.map((p) => {
    const disponibilidad = p.disponibilidad ?? 0
    const forraje = forrajePotrero(p.superficie_ha, disponibilidad)
    return { p, disponibilidad, forraje, da_ha: racionesPorHa(disponibilidad, asignacion), dat: racionesTotales(forraje, asignacion) }
  })
  // PC-04 — Oferta y promedios del campo.
  const suma_forraje = base.reduce((s, b) => s + b.forraje, 0)
  const oferta = base.reduce((s, b) => s + b.dat, 0)
  const suma_superficie = base.reduce((s, b) => s + b.p.superficie_ha, 0)
  const n = base.filter((b) => b.dat > EPS).length

  const alertas: Alerta[] = []
  const filas = base.map<FilaPlanCerrado>(({ p, disponibilidad, forraje, da_ha, dat }) => {
    const en_secuencia = dat > EPS
    const { tp_total, tp_sel } = tiempoPastoreoCerrado(dat, oferta, dias_requeridos, selecciones, en_secuencia ? p.tp_manual : null)
    if (en_secuencia) {
      const al07 = alertaAL07({ potrero_id: p.potrero_id, nombre: p.nombre, tp_calculado: tp_sel })
      if (al07) alertas.push(al07)
    }
    return {
      potrero_id: p.potrero_id,
      nombre: p.nombre,
      orden: p.orden,
      superficie_ha: p.superficie_ha,
      disponibilidad,
      forraje,
      da_ha,
      dat,
      tp_total,
      tp_sel_calculado: tp_sel,
      tp_es_manual: en_secuencia && p.tp_manual != null,
      tp_sel: redondearTP(tp_sel),
      en_secuencia,
      aviso: en_secuencia ? null : AVISO_SIN_PASTO,
    }
  })

  const suma_tp_sel_redondeado = filas.reduce((s, f) => s + f.tp_sel, 0)

  // AL-05 — Potreros que quedarían recortados o sin entrar al encadenar las selecciones (CA-03).
  const recortados: string[] = []
  let t = 0
  for (let sel = 1; sel <= selecciones; sel++) {
    for (const f of filas) {
      if (!f.en_secuencia || f.tp_sel <= EPS) continue
      t += f.tp_sel
      if (t > dias_requeridos + EPS && !recortados.includes(f.nombre)) recortados.push(f.nombre)
    }
  }
  const al05 = alertaAL05({ suma_tp_redondeados: suma_tp_sel_redondeado, selecciones, dias_requeridos, recortados })
  if (al05) alertas.push(al05)

  alertas.push(
    ...alertasAL06(
      filas.map((f) => ({ potrero_id: f.potrero_id, nombre: f.nombre, disponibilidad: f.disponibilidad })),
      entrada.factor_disponibilidad_atipica ?? 3,
    ).alertas,
  )

  return {
    asignacion,
    selecciones,
    dias_requeridos,
    suma_forraje,
    oferta,
    suma_superficie,
    n,
    da_ha_campo: oferta / suma_superficie,
    disp_campo: suma_forraje / suma_superficie,
    receptividad: receptividad(oferta, dias_requeridos),
    suma_tp_total: filas.reduce((s, f) => s + f.tp_total, 0),
    suma_tp_sel_calculado: filas.reduce((s, f) => s + f.tp_sel_calculado, 0),
    suma_tp_sel_redondeado,
    filas,
    alertas,
  }
}
