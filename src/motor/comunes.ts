// Reglas comunes (SPEC 4.1): CM-01 a CM-10, más utilidades de fechas e instantes.

import type { EquivalenciaEV, Fecha, GeometriaPoligono, Instante, Mes } from './tipos'

/** Tolerancia de las comparaciones (SPEC, convenciones). */
export const EPS = 1e-9

/** Error de validación de datos de entrada. */
export class ErrorValidacion extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorValidacion'
  }
}

// ---------- Utilidades de fechas e instantes ----------

const MS_DIA = 86_400_000

/** Número de día (días desde 1970-01-01, UTC) de una fecha ISO. */
export function fechaADia(fecha: Fecha): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  if (!m) throw new ErrorValidacion(`fecha inválida: "${fecha}"`)
  const dia = Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_DIA)
  if (diaAFecha(dia) !== fecha) throw new ErrorValidacion(`fecha inválida: "${fecha}"`)
  return dia
}

/** Fecha ISO de un número de día. */
export function diaAFecha(dia: number): Fecha {
  return new Date(dia * MS_DIA).toISOString().slice(0, 10)
}

/** Fecha + n días. */
export function sumarDiasAFecha(fecha: Fecha, dias: number): Fecha {
  return diaAFecha(fechaADia(fecha) + dias)
}

/** Mes `YYYY-MM` de una fecha. */
export function mesDeFecha(fecha: Fecha): Mes {
  return fecha.slice(0, 7)
}

/** Instante expresado en medios días (entero). AM = inicio del día, PM = mitad. */
export function instanteAMedios(i: Instante): number {
  return fechaADia(i.fecha) * 2 + (i.turno === 'PM' ? 1 : 0)
}

export function mediosAInstante(medios: number): Instante {
  const dia = Math.floor(medios / 2)
  return { fecha: diaAFecha(dia), turno: medios - dia * 2 === 1 ? 'PM' : 'AM' }
}

/** Instante + duración en días (múltiplo de 0.5). */
export function sumarDias(i: Instante, dias: number): Instante {
  return mediosAInstante(instanteAMedios(i) + Math.round(dias * 2))
}

/** Negativo si a < b, 0 si son iguales, positivo si a > b. */
export function compararInstantes(a: Instante, b: Instante): number {
  return instanteAMedios(a) - instanteAMedios(b)
}

// ---------- Reglas ----------

/** CM-01 — Días del plan: fecha_fin − fecha_inicio + 1 (ambas incluidas). */
export function diasPlan(fechaInicio: Fecha, fechaFin: Fecha): number {
  const dias = fechaADia(fechaFin) - fechaADia(fechaInicio) + 1
  if (dias < 1) throw new ErrorValidacion('la fecha de fin no puede ser anterior a la de inicio')
  return dias
}

export interface MesPlan {
  mes: Mes
  dias: number
}

/** CM-02 — Meses del plan: días del plan que caen en cada mes calendario. La suma es dias_plan. */
export function mesesPlan(fechaInicio: Fecha, fechaFin: Fecha): MesPlan[] {
  const ini = fechaADia(fechaInicio)
  const fin = fechaADia(fechaFin)
  if (fin < ini) throw new ErrorValidacion('la fecha de fin no puede ser anterior a la de inicio')
  const meses: MesPlan[] = []
  for (let d = ini; d <= fin; d++) {
    const mes = mesDeFecha(diaAFecha(d))
    const ultimo = meses[meses.length - 1]
    if (ultimo && ultimo.mes === mes) ultimo.dias += 1
    else meses.push({ mes, dias: 1 })
  }
  return meses
}

const RADIO_TIERRA_M = 6_378_137

function areaAnilloM2(anillo: number[][]): number {
  let pts = anillo
  const n0 = pts.length
  if (n0 > 1 && pts[0][0] === pts[n0 - 1][0] && pts[0][1] === pts[n0 - 1][1]) pts = pts.slice(0, -1)
  const n = pts.length
  if (n < 3) return 0
  const rad = (g: number) => (g * Math.PI) / 180
  let total = 0
  for (let i = 0; i < n; i++) {
    const inferior = pts[i]
    const medio = pts[(i + 1) % n]
    const superior = pts[(i + 2) % n]
    total += (rad(superior[0]) - rad(inferior[0])) * Math.sin(rad(medio[1]))
  }
  return Math.abs((total * RADIO_TIERRA_M * RADIO_TIERRA_M) / 2)
}

/**
 * CM-03 — Superficie calculada: área geodésica del polígono en WGS84, en ha (m² / 10000),
 * redondeada a 2 decimales. Usa la misma aproximación esférica que Turf.js (radio 6378137 m).
 */
export function superficieCalculadaHa(geometria: GeometriaPoligono): number {
  const [exterior, ...huecos] = geometria.coordinates
  if (!exterior) return 0
  const m2 = areaAnilloM2(exterior) - huecos.reduce((s, h) => s + areaAnilloM2(h), 0)
  return Math.round((m2 / 10_000) * 100) / 100
}

/** CM-03 — Superficie del potrero: la declarada si está cargada; si no, la calculada. */
export function superficiePotrero(potrero: {
  superficie_declarada_ha?: number | null
  superficie_calculada_ha?: number | null
}): number | null {
  return potrero.superficie_declarada_ha ?? potrero.superficie_calculada_ha ?? null
}

export interface ResultadoEvUnitario {
  ev_unitario: number | null
  ev_manual: boolean
}

/**
 * CM-04 — EV unitario: fila de la tabla con la misma categoría y estado fisiológico y
 * peso_min ≤ peso < peso_max. Si no hay fila queda vacío y ev_manual = true.
 */
export function evUnitario(
  tabla: Pick<EquivalenciaEV, 'categoria_id' | 'estado_fisiologico' | 'peso_min_kg' | 'peso_max_kg' | 'ev'>[],
  categoriaId: string,
  estadoFisiologico: string,
  pesoPromedioKg: number,
): ResultadoEvUnitario {
  const fila = tabla.find(
    (e) =>
      e.categoria_id === categoriaId &&
      e.estado_fisiologico === estadoFisiologico &&
      e.peso_min_kg <= pesoPromedioKg &&
      pesoPromedioKg < e.peso_max_kg,
  )
  return fila ? { ev_unitario: fila.ev, ev_manual: false } : { ev_unitario: null, ev_manual: true }
}

export interface FilaRodeo {
  cantidad: number
  /** Nulo mientras el usuario no lo cargó (CM-04); cuenta como 0. */
  ev_unitario: number | null
}

export interface ResultadoEvRodeo {
  /** ev_categoria de cada fila, en el mismo orden. */
  ev_categorias: number[]
  ev: number
  cabezas: number
}

/** CM-05 — EV del rodeo: ev_categoria = cantidad × ev_unitario; ev_mes = Σ; cabezas = Σ cantidad. */
export function evRodeo(filas: FilaRodeo[]): ResultadoEvRodeo {
  const ev_categorias = filas.map((f) => f.cantidad * (f.ev_unitario ?? 0))
  return {
    ev_categorias,
    ev: ev_categorias.reduce((s, x) => s + x, 0),
    cabezas: filas.reduce((s, f) => s + f.cantidad, 0),
  }
}

export interface FilaComposicion extends FilaRodeo {
  mes: Mes
}

/**
 * CM-06 — EV del rodeo en una fecha: el del mes que contiene la fecha. Después del fin del plan
 * se usa el último mes del plan. Si el mes no tiene composición, la del mes anterior más cercano.
 */
export function evRodeoEnFecha(
  composicion: FilaComposicion[],
  fecha: Fecha,
  fechaFinPlan: Fecha,
): ResultadoEvRodeo & { mes_usado: Mes | null } {
  const objetivo = mesDeFecha(fechaADia(fecha) > fechaADia(fechaFinPlan) ? fechaFinPlan : fecha)
  let mesUsado: Mes | null = null
  for (const fila of composicion) {
    if (fila.mes <= objetivo && (mesUsado === null || fila.mes > mesUsado)) mesUsado = fila.mes
  }
  return { ...evRodeo(composicion.filter((f) => f.mes === mesUsado)), mes_usado: mesUsado }
}

export interface ResultadoCarga {
  sup_celula: number
  /** EV/ha. */
  carga: number
  /** ha/EV. */
  ha_por_ev: number
}

/** CM-07 — Carga animal: ev_mes / sup_celula (EV/ha) y su inversa (ha/EV). */
export function cargaAnimal(evMes: number, superficies: number[]): ResultadoCarga {
  const sup_celula = superficies.reduce((s, x) => s + x, 0)
  return { sup_celula, carga: evMes / sup_celula, ha_por_ev: sup_celula / evMes }
}

/** CM-08 — Densidad: ev_rodeo / sup_i (EV/ha) y cabezas / sup_i (cabezas/ha). */
export function densidad(
  evDelRodeo: number,
  cabezas: number,
  superficieHa: number,
): { ev_ha: number; cabezas_ha: number } {
  return { ev_ha: evDelRodeo / superficieHa, cabezas_ha: cabezas / superficieHa }
}

/** CM-09 — Redondeo del tiempo de pastoreo. */
export function redondearTP(x: number): number {
  if (x <= EPS) return 0
  if (x <= 0.5 + EPS) return 0.5
  if (x <= 1 + EPS) return 1
  return Math.ceil(x - EPS)
}

/** CM-10 — Diferencia entre instantes, en días. */
export function diasEntre(a: Instante, b: Instante): number {
  return (
    fechaADia(b.fecha) - fechaADia(a.fecha) + (b.turno === 'PM' ? 0.5 : 0) - (a.turno === 'PM' ? 0.5 : 0)
  )
}

/** Escribe un número con hasta `decimales` decimales, sin ceros de relleno. */
export function formatearNumero(x: number, decimales = 2): string {
  return String(Number(x.toFixed(decimales)))
}
