// Registro plan vs. real (SPEC 4.5): RG-01 a RG-07.

import { alertaAL02 } from './alertas'
import { eventoQueBloquea } from './calendario'
import { EPS, ErrorValidacion, compararInstantes, diasEntre, fechaADia, instanteAMedios, sumarDiasAFecha } from './comunes'
import { tasaVigente, trExigido, trVigente } from './planAbierto'
import type {
  Alerta,
  EventoEntrada,
  Fecha,
  Instante,
  MovimientoCalculado,
  PeriodoCalculado,
  PeriodoRecuperacion,
  TramoEntrada,
} from './tipos'

const entradaDe = (m: Pick<MovimientoCalculado, 'fecha_entrada' | 'turno_entrada'>): Instante => ({
  fecha: m.fecha_entrada,
  turno: m.turno_entrada,
})

const salidaDe = (m: MovimientoCalculado): Instante | null =>
  m.fecha_salida !== null && m.turno_salida !== null ? { fecha: m.fecha_salida, turno: m.turno_salida } : null

const entradaPeriodo = (p: PeriodoCalculado): Instante => ({ fecha: p.fecha_entrada, turno: p.turno_entrada })

export interface EntradaRodeo {
  id?: string
  potrero_id: string
  instante: Instante
  /** Copia de ev_rodeo y cabezas de la fecha de entrada (CM-06). */
  ev_rodeo: number
  cabezas: number
  observaciones?: string | null
}

export interface ResultadoRegistrarEntrada {
  /** Todos los movimientos de la célula, con el anterior cerrado y el nuevo agregado al final. */
  movimientos: MovimientoCalculado[]
  nuevo: MovimientoCalculado
  /** Movimiento que se cerró, si había uno abierto. */
  cerrado: MovimientoCalculado | null
}

/**
 * RG-01 — Movimiento real: registrar una entrada en el instante E cierra el movimiento abierto de
 * la célula con salida E y crea uno nuevo abierto. Si el potrero coincide con el del próximo
 * período planificado vigente sin registrar, el movimiento se vincula a ese período; si no,
 * queda sin vínculo ("no planificado").
 */
export function registrarEntrada(
  movimientos: MovimientoCalculado[],
  periodos: PeriodoCalculado[],
  entrada: EntradaRodeo,
): ResultadoRegistrarEntrada {
  const abiertos = movimientos.filter((m) => m.fecha_salida === null)
  if (abiertos.length > 1) throw new ErrorValidacion('hay más de un movimiento abierto en la célula')
  for (const m of movimientos) {
    if (compararInstantes(entrada.instante, entradaDe(m)) < 0) {
      throw new ErrorValidacion('un movimiento no puede empezar antes que el anterior')
    }
  }
  let cerrado: MovimientoCalculado | null = null
  const actualizados = movimientos.map((m) => {
    if (m.fecha_salida !== null) return m
    cerrado = { ...m, fecha_salida: entrada.instante.fecha, turno_salida: entrada.instante.turno }
    return cerrado
  })

  const registrados = new Set(movimientos.map((m) => m.periodo_pastoreo_id).filter((id): id is string => id !== null))
  const proximo = periodos
    .filter((p) => p.vigente && p.id !== undefined && !registrados.has(p.id))
    .sort((a, b) => compararInstantes(entradaPeriodo(a), entradaPeriodo(b)))[0]

  const nuevo: MovimientoCalculado = {
    ...(entrada.id !== undefined ? { id: entrada.id } : {}),
    potrero_id: entrada.potrero_id,
    periodo_pastoreo_id: proximo && proximo.potrero_id === entrada.potrero_id ? (proximo.id as string) : null,
    fecha_entrada: entrada.instante.fecha,
    turno_entrada: entrada.instante.turno,
    fecha_salida: null,
    turno_salida: null,
    ev_rodeo: entrada.ev_rodeo,
    cabezas: entrada.cabezas,
    observaciones: entrada.observaciones ?? null,
  }
  return { movimientos: [...actualizados, nuevo], nuevo, cerrado }
}

/** RG-02 — Días reales: dias(entrada, salida). Para el movimiento abierto, la salida es `ahora`. */
export function diasReales(movimiento: MovimientoCalculado, ahora?: Instante): number {
  const salida = salidaDe(movimiento) ?? ahora
  if (!salida) throw new ErrorValidacion('el movimiento está abierto: hace falta el instante actual')
  return diasEntre(entradaDe(movimiento), salida)
}

export interface Desvio {
  /** dias_reales − duracion_planificada. Positivo = más largo que el plan. */
  desvio_dias: number
  /** dias(entrada_planificada, entrada_real). Positivo = más tarde que el plan. */
  desvio_entrada: number
}

/** RG-03 — Desvío de un movimiento vinculado respecto de su período planificado. */
export function desvio(movimiento: MovimientoCalculado, periodo: PeriodoCalculado, ahora?: Instante): Desvio {
  return {
    desvio_dias: diasReales(movimiento, ahora) - periodo.duracion_dias,
    desvio_entrada: diasEntre(entradaPeriodo(periodo), entradaDe(movimiento)),
  }
}

export interface PlanAbiertoRecuperacion {
  fecha_inicio: Fecha
  fecha_fin: Fecha
  tr_min: number
  tr_max: number
  tramos?: TramoEntrada[]
}

export interface ResultadoRecuperaciones {
  recuperaciones: PeriodoRecuperacion[]
  /** AL-02. */
  alertas: Alerta[]
}

/**
 * RG-04 — Recuperación real: para dos movimientos consecutivos en el mismo potrero,
 * recuperacion = dias(salida_anterior, entrada_siguiente). Si el intervalo cae en un plan abierto
 * y recuperacion < TR exigido (PA-11) se emite AL-02. Para el último pastoreo, la recuperación en
 * curso es dias(salida, ahora).
 */
export function recuperacionesReales(
  movimientos: MovimientoCalculado[],
  opciones: { ahora?: Instante; plan_abierto?: PlanAbiertoRecuperacion | null; nombres?: Record<string, string> } = {},
): ResultadoRecuperaciones {
  const plan = opciones.plan_abierto ?? null
  const recuperaciones: PeriodoRecuperacion[] = []
  const alertas: Alerta[] = []
  const porPotrero = new Map<string, MovimientoCalculado[]>()
  for (const m of [...movimientos].sort((a, b) => compararInstantes(entradaDe(a), entradaDe(b)))) {
    porPotrero.set(m.potrero_id, [...(porPotrero.get(m.potrero_id) ?? []), m])
  }
  const enPlan = (desde: Instante, hasta: Instante): boolean =>
    plan !== null &&
    fechaADia(desde.fecha) >= fechaADia(plan.fecha_inicio) &&
    instanteAMedios(hasta) <= instanteAMedios({ fecha: sumarDiasAFecha(plan.fecha_fin, 1), turno: 'AM' })

  for (const [potrero_id, lista] of porPotrero) {
    lista.forEach((mov, i) => {
      const desde = salidaDe(mov)
      if (!desde) return
      const siguiente = lista[i + 1]
      const hasta = siguiente ? entradaDe(siguiente) : (opciones.ahora ?? null)
      if (!hasta) return
      const dias = diasEntre(desde, hasta)
      const tr = plan !== null && enPlan(desde, hasta) ? trExigido(plan.tramos ?? [], desde, hasta, plan.tr_min, plan.tr_max) : null
      if (!siguiente) {
        recuperaciones.push({ potrero_id, origen: 'real', desde, hasta: null, dias, tr_exigido: tr, estado: 'en_curso' })
        return
      }
      const al02 =
        tr === null
          ? null
          : alertaAL02({ potrero_id, nombre: opciones.nombres?.[potrero_id] ?? potrero_id, recuperacion: dias, tr_exigido: tr })
      if (al02) alertas.push(al02)
      recuperaciones.push({ potrero_id, origen: 'real', desde, hasta, dias, tr_exigido: tr, estado: al02 ? 'no_cumple' : 'cumple' })
    })
  }
  return { recuperaciones, alertas }
}

export interface Cosecha {
  /** DA. */
  da_cosechados: number
  /** DA/ha. */
  da_ha_real: number
}

/** RG-05 — Cosecha real: DA_cosechados = ev_rodeo × dias_reales; DAha_real = DA_cosechados / sup_i. */
export function cosechaReal(evDelRodeo: number, diasRealesMov: number, superficieHa: number): Cosecha {
  const da_cosechados = evDelRodeo * diasRealesMov
  return { da_cosechados, da_ha_real: da_cosechados / superficieHa }
}

/** RG-05 — Cosecha acumulada de un potrero: suma de todos sus movimientos (los del plan que se pasen). */
export function cosechaPotrero(
  movimientos: MovimientoCalculado[],
  potreroId: string,
  superficieHa: number,
  ahora?: Instante,
): Cosecha {
  const da_cosechados = movimientos
    .filter((m) => m.potrero_id === potreroId)
    .reduce((s, m) => s + m.ev_rodeo * diasReales(m, ahora), 0)
  return { da_cosechados, da_ha_real: da_cosechados / superficieHa }
}

/** RG-07 — Utilización real (plan cerrado): Σ DA_cosechados_i / DAT_i × 100. Nula si DAT = 0. */
export function utilizacionReal(daCosechados: number, dat: number): number | null {
  return dat > EPS ? (daCosechados / dat) * 100 : null
}

export type EstadoPotrero =
  | 'ocupado'
  | 'en_recuperacion'
  | 'recuperado'
  | 'pastoreado'
  | 'pendiente'
  | 'fuera_de_plan'
  | 'bloqueado'

export type PlanActivoEstado =
  | { tipo: 'abierto'; potrero_ids: string[]; tr_min: number; tr_max: number; tramos?: TramoEntrada[] }
  | { tipo: 'cerrado'; potrero_ids: string[]; periodos: Pick<PeriodoCalculado, 'potrero_id' | 'vigente'>[] }

export interface ContextoEstadoPotrero {
  potrero_id: string
  ahora: Instante
  /** Plan activo de la célula, o null si no hay. */
  plan: PlanActivoEstado | null
  /** Movimientos reales de la célula durante el plan activo. */
  movimientos: MovimientoCalculado[]
  eventos?: EventoEntrada[]
}

export interface ResultadoEstadoPotrero {
  estado: EstadoPotrero
  /** dias(salida, ahora) del último pastoreo cerrado; null si nunca fue pastoreado. */
  dias_descanso: number | null
  /** TR vigente (plan abierto). */
  tr_vigente: number | null
  /** dias / TR, solo en `en_recuperacion`. */
  avance: number | null
}

/** RG-06 — Estado del potrero (color en el mapa). */
export function estadoPotrero(c: ContextoEstadoPotrero): ResultadoEstadoPotrero {
  const propios = c.movimientos.filter((m) => m.potrero_id === c.potrero_id)
  const cerrados = propios.filter((m) => m.fecha_salida !== null)
  let ultimaSalida: Instante | null = null
  for (const m of cerrados) {
    const s = salidaDe(m) as Instante
    if (ultimaSalida === null || compararInstantes(s, ultimaSalida) > 0) ultimaSalida = s
  }
  const dias_descanso = ultimaSalida ? diasEntre(ultimaSalida, c.ahora) : null
  const tr_vigente =
    c.plan?.tipo === 'abierto' ? trVigente(tasaVigente(c.plan.tramos ?? [], c.ahora.fecha), c.plan.tr_min, c.plan.tr_max) : null
  const resultado = (estado: EstadoPotrero, avance: number | null = null): ResultadoEstadoPotrero => ({
    estado,
    dias_descanso,
    tr_vigente,
    avance,
  })

  if (propios.some((m) => m.fecha_salida === null)) return resultado('ocupado')
  if (eventoQueBloquea(c.eventos ?? [], c.potrero_id, c.ahora.fecha)) return resultado('bloqueado')
  if (!c.plan || !c.plan.potrero_ids.includes(c.potrero_id)) return resultado('fuera_de_plan')
  if (c.plan.tipo === 'abierto') {
    if (dias_descanso !== null && tr_vigente !== null) {
      return dias_descanso < tr_vigente - EPS ? resultado('en_recuperacion', dias_descanso / tr_vigente) : resultado('recuperado')
    }
    return resultado('pendiente')
  }
  const planificadas = c.plan.periodos.filter((p) => p.vigente && p.potrero_id === c.potrero_id).length
  if (planificadas > 0 && cerrados.length >= planificadas) return resultado('pastoreado')
  return resultado('pendiente')
}
