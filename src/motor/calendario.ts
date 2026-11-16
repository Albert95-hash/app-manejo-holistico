// Calendario (SPEC 4.4): CA-01 a CA-06.

import { alertaAL05, alertaAL08, alertaAL09 } from './alertas'
import { EPS, ErrorValidacion, fechaADia, instanteAMedios, mediosAInstante } from './comunes'
import { tasaVigente } from './planAbierto'
import type { Alerta, EventoEntrada, Fecha, Instante, PeriodoCalculado, TramoEntrada } from './tipos'

/** CA-01 — Secuencia: ordena los potreros incluidos por su `orden`, que debe ser único. */
export function secuencia<T extends { orden: number }>(potreros: T[]): T[] {
  const ordenados = [...potreros].sort((a, b) => a.orden - b.orden)
  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i].orden === ordenados[i - 1].orden) {
      throw new ErrorValidacion(`el orden ${ordenados[i].orden} está repetido en la secuencia`)
    }
  }
  return ordenados
}

/**
 * CA-04 — Potrero bloqueado: existe un evento con bloquea_pastoreo = true que lo incluye
 * (lista de potreros vacía = todo el campo) y cuya fecha cae entre fecha_desde y fecha_hasta.
 * Devuelve el evento que bloquea, o null.
 */
export function eventoQueBloquea(eventos: EventoEntrada[], potreroId: string, fecha: Fecha): EventoEntrada | null {
  return (
    eventos.find(
      (e) =>
        e.bloquea_pastoreo &&
        (e.potrero_ids.length === 0 || e.potrero_ids.includes(potreroId)) &&
        e.fecha_desde <= fecha &&
        fecha <= e.fecha_hasta,
    ) ?? null
  )
}

/** CA-04 — Potrero bloqueado en un instante. */
export function estaBloqueado(eventos: EventoEntrada[], potreroId: string, instante: Instante): boolean {
  return eventoQueBloquea(eventos, potreroId, instante.fecha) !== null
}

/** Salida de un período: entrada + duracion_dias (SPEC 5.3). */
export function salidaPeriodo(p: Pick<PeriodoCalculado, 'fecha_entrada' | 'turno_entrada' | 'duracion_dias'>): Instante {
  return mediosAInstante(entradaMedios(p) + Math.round(p.duracion_dias * 2))
}

function entradaMedios(p: Pick<PeriodoCalculado, 'fecha_entrada' | 'turno_entrada'>): number {
  return instanteAMedios({ fecha: p.fecha_entrada, turno: p.turno_entrada })
}

function salidaMedios(p: Pick<PeriodoCalculado, 'fecha_entrada' | 'turno_entrada' | 'duracion_dias'>): number {
  return entradaMedios(p) + Math.round(p.duracion_dias * 2)
}

/** Acumula AL-09 sin repetir la misma combinación potrero + evento. */
function registrarBloqueo(alertas: Alerta[], vistos: Set<string>, potrero: { potrero_id: string; nombre: string }, evento: EventoEntrada): void {
  const clave = `${potrero.potrero_id}|${evento.id ?? ''}|${evento.fecha_desde}|${evento.fecha_hasta}`
  if (vistos.has(clave)) return
  vistos.add(clave)
  alertas.push(alertaAL09({ potrero_id: potrero.potrero_id, nombre: potrero.nombre, fecha_desde: evento.fecha_desde, fecha_hasta: evento.fecha_hasta }))
}

export interface ResultadoCalendario {
  periodos: PeriodoCalculado[]
  alertas: Alerta[]
}

// ---------- CA-02 ----------

export interface PotreroCalendarioAbierto {
  potrero_id: string
  nombre: string
  /** TP redondeados (PA-06, CM-09). */
  tp_min: number
  tp_max: number
}

export interface CalendarioAbiertoEntrada {
  /** En el orden de la secuencia (CA-01). */
  potreros: PotreroCalendarioAbierto[]
  fecha_inicio: Fecha
  fecha_fin: Fecha
  tramos?: TramoEntrada[]
  eventos?: EventoEntrada[]
  /** Instante inicial. Por defecto (fecha_inicio, AM). */
  inicio?: Instante
  /** Posición en la secuencia del primer potrero a recorrer. Por defecto 0. */
  indice_inicial?: number
  /** Por defecto 1. */
  vuelta_inicial?: number
  /** Versión de los períodos generados. Por defecto 1. */
  version?: number
}

/** CA-02 — Generación del calendario en plan abierto. Emite AL-08 y AL-09. */
export function generarCalendarioAbierto(e: CalendarioAbiertoEntrada): ResultadoCalendario {
  const n = e.potreros.length
  const periodos: PeriodoCalculado[] = []
  const alertas: Alerta[] = []
  if (n === 0) return { periodos, alertas }
  const tramos = e.tramos ?? []
  const eventos = e.eventos ?? []
  const fin = (fechaADia(e.fecha_fin) + 1) * 2
  let t = instanteAMedios(e.inicio ?? { fecha: e.fecha_inicio, turno: 'AM' })
  let k = (e.indice_inicial ?? 0) % n
  let vuelta = e.vuelta_inicial ?? 1
  const bloqueosVistos = new Set<string>()
  let avisoNula = false
  // Potreros salteados seguidos y posición donde empezó la racha.
  let salteados = 0
  let kRacha = k
  let vueltaRacha = vuelta

  const siguiente = () => {
    k += 1
    if (k === n) {
      k = 0
      vuelta += 1
    }
  }
  const saltear = () => {
    if (salteados === 0) {
      kRacha = k
      vueltaRacha = vuelta
    }
    salteados += 1
    siguiente()
    if (salteados >= n) {
      // Paso 6: todos bloqueados en t → se avanza medio día y se retoma donde empezó la racha.
      t += 1
      k = kRacha
      vuelta = vueltaRacha
      salteados = 0
    }
  }

  while (t < fin) {
    const potrero = e.potreros[k]
    const fecha = mediosAInstante(t).fecha
    const evento = eventoQueBloquea(eventos, potrero.potrero_id, fecha)
    if (evento) {
      registrarBloqueo(alertas, bloqueosVistos, potrero, evento)
      saltear()
      continue
    }
    const tasa = tasaVigente(tramos, fecha)
    const dur = Math.round((tasa === 'rapida' ? potrero.tp_min : potrero.tp_max) * 2)
    if (dur <= 0) {
      saltear()
      continue
    }
    salteados = 0
    if (tasa === 'nula' && !avisoNula) {
      avisoNula = true
      const al08 = alertaAL08(tasa)
      if (al08) alertas.push(al08)
    }
    const recortado = t + dur > fin
    const durFinal = recortado ? fin - t : dur
    const entrada = mediosAInstante(t)
    periodos.push({
      potrero_id: potrero.potrero_id,
      version: e.version ?? 1,
      vigente: true,
      vuelta,
      numero_seleccion: null,
      fecha_entrada: entrada.fecha,
      turno_entrada: entrada.turno,
      duracion_dias: durFinal / 2,
      tasa_aplicada: tasa,
      editado_manual: false,
      recortado,
    })
    t += durFinal
    siguiente()
  }
  return { periodos, alertas }
}

// ---------- CA-03 ----------

export interface PotreroCalendarioCerrado {
  potrero_id: string
  nombre: string
  /** PC-03. Los potreros con DAT = 0 no entran en la secuencia. */
  dat: number
  /** TPsel redondeado (PC-06, CM-09). */
  tp_sel: number
}

export interface CalendarioCerradoEntrada {
  /** En el orden de la secuencia (CA-01). */
  potreros: PotreroCalendarioCerrado[]
  fecha_inicio: Fecha
  fecha_fin: Fecha
  selecciones: number
  dias_reserva?: number
  eventos?: EventoEntrada[]
  /** Instante inicial. Por defecto (fecha_inicio, AM). */
  inicio?: Instante
  /** Por defecto 1. */
  seleccion_inicial?: number
  /** Posición, entre los potreros con DAT > 0, del primero a recorrer en la selección inicial. Por defecto 0. */
  indice_inicial?: number
  /** Versión de los períodos generados. Por defecto 1. */
  version?: number
}

export interface ResultadoCalendarioCerrado extends ResultadoCalendario {
  /** Nombres de los potreros recortados o que quedaron sin entrar (AL-05). */
  recortados: string[]
}

/** CA-03 — Generación del calendario en plan cerrado. Emite AL-05 y AL-09. */
export function generarCalendarioCerrado(e: CalendarioCerradoEntrada): ResultadoCalendarioCerrado {
  const periodos: PeriodoCalculado[] = []
  const alertas: Alerta[] = []
  const recortados: string[] = []
  const eventos = e.eventos ?? []
  const diasReserva = e.dias_reserva ?? 0
  const fin = (fechaADia(e.fecha_fin) + 1 + diasReserva) * 2
  let t = instanteAMedios(e.inicio ?? { fecha: e.fecha_inicio, turno: 'AM' })
  const conPasto = e.potreros.filter((p) => p.dat > EPS)
  const bloqueosVistos = new Set<string>()
  const anotarRecortado = (nombre: string) => {
    if (!recortados.includes(nombre)) recortados.push(nombre)
  }
  const selInicial = e.seleccion_inicial ?? 1

  for (let sel = selInicial; sel <= e.selecciones; sel++) {
    const cola = sel === selInicial ? conPasto.slice(e.indice_inicial ?? 0) : [...conPasto]
    const pospuestos = new Set<string>()
    while (cola.length > 0) {
      const potrero = cola.shift() as PotreroCalendarioCerrado
      const dur = Math.round(potrero.tp_sel * 2)
      if (dur <= 0) continue
      if (t >= fin) {
        anotarRecortado(potrero.nombre)
        continue
      }
      const evento = eventoQueBloquea(eventos, potrero.potrero_id, mediosAInstante(t).fecha)
      if (evento) {
        if (!pospuestos.has(potrero.potrero_id)) {
          // Paso 3: bloqueado → al final de esta selección.
          pospuestos.add(potrero.potrero_id)
          cola.push(potrero)
        } else {
          registrarBloqueo(alertas, bloqueosVistos, potrero, evento)
        }
        continue
      }
      const recortado = t + dur > fin
      const durFinal = recortado ? fin - t : dur
      if (recortado) anotarRecortado(potrero.nombre)
      const entrada = mediosAInstante(t)
      periodos.push({
        potrero_id: potrero.potrero_id,
        version: e.version ?? 1,
        vigente: true,
        vuelta: null,
        numero_seleccion: sel,
        fecha_entrada: entrada.fecha,
        turno_entrada: entrada.turno,
        duracion_dias: durFinal / 2,
        tasa_aplicada: null,
        editado_manual: false,
        recortado,
      })
      t += durFinal
    }
  }

  if (recortados.length > 0) {
    const suma = conPasto.reduce((s, p) => s + p.tp_sel, 0)
    const al05 = alertaAL05({
      suma_tp_redondeados: suma,
      selecciones: e.selecciones,
      dias_requeridos: fechaADia(e.fecha_fin) - fechaADia(e.fecha_inicio) + 1 + diasReserva,
      recortados,
    })
    if (al05) alertas.push(al05)
  }
  return { periodos, alertas, recortados }
}

// ---------- CA-05 ----------

/**
 * CA-05 — Edición manual: cambia la duración (múltiplo de 0.5) del período `indice` de una lista
 * de períodos vigentes ordenada por entrada. El período queda editado_manual = true y los
 * posteriores se corren para quedar encadenados (entrada = salida del anterior).
 */
export function editarDuracion(periodos: PeriodoCalculado[], indice: number, nuevaDuracion: number): PeriodoCalculado[] {
  if (indice < 0 || indice >= periodos.length) throw new ErrorValidacion('el período no existe')
  if (nuevaDuracion < 0 || Math.abs(nuevaDuracion * 2 - Math.round(nuevaDuracion * 2)) > EPS) {
    throw new ErrorValidacion('la duración debe ser un múltiplo de 0.5')
  }
  const resultado = periodos.map((p) => ({ ...p }))
  resultado[indice].duracion_dias = nuevaDuracion
  resultado[indice].editado_manual = true
  for (let i = indice + 1; i < resultado.length; i++) {
    const entrada = salidaPeriodo(resultado[i - 1])
    resultado[i].fecha_entrada = entrada.fecha
    resultado[i].turno_entrada = entrada.turno
  }
  return resultado
}

// ---------- CA-06 ----------

interface BaseReplanificacion {
  /** Todos los períodos, con los de entrada ≥ T ya marcados como no vigentes. */
  periodos: PeriodoCalculado[]
  /** Instante donde empieza la generación nueva. */
  inicio: Instante
  /** Último período vigente que se conserva (el último ocupado según el plan). */
  ultimo: PeriodoCalculado | null
}

/** CA-06, pasos 1 y 2 — Da de baja los períodos con entrada ≥ T y conserva el que contiene a T. */
function prepararReplanificacion(periodos: PeriodoCalculado[], T: Instante): BaseReplanificacion {
  const tMedios = instanteAMedios(T)
  const actualizados = periodos.map((p) => (p.vigente && entradaMedios(p) >= tMedios ? { ...p, vigente: false } : { ...p }))
  let ultimo: PeriodoCalculado | null = null
  for (const p of actualizados) {
    if (p.vigente && (ultimo === null || entradaMedios(p) > entradaMedios(ultimo))) ultimo = p
  }
  const inicioMedios = ultimo && salidaMedios(ultimo) > tMedios ? salidaMedios(ultimo) : tMedios
  return { periodos: actualizados, inicio: mediosAInstante(inicioMedios), ultimo }
}

export interface ResultadoReplanificacion {
  /** Períodos anteriores (vigentes y no vigentes) más los nuevos. */
  periodos: PeriodoCalculado[]
  /** Solo los períodos generados. */
  nuevos: PeriodoCalculado[]
  version_calendario: number
  alertas: Alerta[]
}

export interface ReplanificacionAbiertaEntrada
  extends Omit<CalendarioAbiertoEntrada, 'inicio' | 'indice_inicial' | 'vuelta_inicial' | 'version'> {
  periodos: PeriodoCalculado[]
  /** Instante T desde el que se replanifica. Al cambiar la tasa: (fecha del cambio, AM). */
  desde: Instante
  version_calendario: number
  /** Potrero del movimiento real abierto, si existe. */
  potrero_movimiento_abierto?: string | null
}

/** CA-06 — Replanificación de un plan abierto desde el instante T. */
export function replanificarAbierto(e: ReplanificacionAbiertaEntrada): ResultadoReplanificacion {
  const base = prepararReplanificacion(e.periodos, e.desde)
  const version = e.version_calendario + 1
  const ocupado = e.potrero_movimiento_abierto ?? base.ultimo?.potrero_id ?? null
  const pos = ocupado === null ? -1 : e.potreros.findIndex((p) => p.potrero_id === ocupado)
  let indice = pos + 1
  let vuelta = base.ultimo?.vuelta ?? 1
  if (pos >= 0 && indice >= e.potreros.length) {
    indice = 0
    vuelta += 1
  }
  const generado = generarCalendarioAbierto({
    ...e,
    inicio: base.inicio,
    indice_inicial: indice,
    vuelta_inicial: vuelta,
    version,
  })
  return {
    periodos: [...base.periodos, ...generado.periodos],
    nuevos: generado.periodos,
    version_calendario: version,
    alertas: generado.alertas,
  }
}

export interface ReplanificacionCerradaEntrada
  extends Omit<CalendarioCerradoEntrada, 'inicio' | 'indice_inicial' | 'seleccion_inicial' | 'version'> {
  periodos: PeriodoCalculado[]
  /** Instante T desde el que se replanifica. */
  desde: Instante
  version_calendario: number
  /** Potrero del movimiento real abierto, si existe. */
  potrero_movimiento_abierto?: string | null
}

/** CA-06 — Replanificación de un plan cerrado desde el instante T. */
export function replanificarCerrado(e: ReplanificacionCerradaEntrada): ResultadoReplanificacion & { recortados: string[] } {
  const base = prepararReplanificacion(e.periodos, e.desde)
  const version = e.version_calendario + 1
  const conPasto = e.potreros.filter((p) => p.dat > EPS)
  const ocupado = e.potrero_movimiento_abierto ?? base.ultimo?.potrero_id ?? null
  const pos = ocupado === null ? -1 : conPasto.findIndex((p) => p.potrero_id === ocupado)
  let indice = pos + 1
  let seleccion = base.ultimo?.numero_seleccion ?? 1
  if (pos >= 0 && indice >= conPasto.length) {
    indice = 0
    seleccion += 1
  }
  const generado = generarCalendarioCerrado({
    ...e,
    inicio: base.inicio,
    indice_inicial: indice,
    seleccion_inicial: seleccion,
    version,
  })
  return {
    periodos: [...base.periodos, ...generado.periodos],
    nuevos: generado.periodos,
    version_calendario: version,
    alertas: generado.alertas,
    recortados: generado.recortados,
  }
}
