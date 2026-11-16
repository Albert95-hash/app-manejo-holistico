// Monitoreo ambiental (SPEC 4.6): MO-01 a MO-07.

import { alertaAL10 } from './alertas'
import type { Alerta, Estacionalidad, Fecha, TipoFila } from './tipos'

/** Fila de una muestra tal como se carga (puede estar incompleta). */
export interface FilaEntrada {
  tipo: TipoFila
  /** Nombre de la especie (filas `especie`). */
  nombre?: string | null
  especie_id?: string | null
  cobertura_pct?: number | null
  grupo_funcional_id?: string | null
  estacionalidad?: Estacionalidad | null
}

export interface MuestraEntrada {
  filas: FilaEntrada[]
}

/**
 * MO-01 — Fila válida: cobertura entre 0 y 100 y grupo funcional. Las filas `especie` necesitan
 * además nombre. Las filas `suelo_desnudo` pertenecen al grupo marcado como suelo desnudo, así
 * que no necesitan grupo cargado.
 */
export function filaValida(fila: FilaEntrada): boolean {
  const c = fila.cobertura_pct
  if (c == null || !Number.isFinite(c) || c < 0 || c > 100) return false
  if (fila.tipo === 'suelo_desnudo') return true
  const tieneNombre = (fila.nombre != null && fila.nombre.trim() !== '') || fila.especie_id != null
  return tieneNombre && fila.grupo_funcional_id != null
}

/** MO-01 — Grupo de una fila: el propio, o el de suelo desnudo para las filas `suelo_desnudo`. */
export function grupoDeFila(fila: FilaEntrada, grupoSueloDesnudoId: string): string | null {
  return fila.tipo === 'suelo_desnudo' ? grupoSueloDesnudoId : (fila.grupo_funcional_id ?? null)
}

/**
 * MO-02 — Clave normalizada: minúsculas, sin espacios al inicio ni al final, sin tildes y con
 * los espacios internos colapsados.
 */
export function claveNormalizada(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** MO-02 — Busca la especie en el catálogo por su clave; si existe se proponen su grupo y estacionalidad. */
export function buscarEspecie<T extends { clave_normalizada: string }>(catalogo: T[], nombre: string): T | null {
  const clave = claveNormalizada(nombre)
  return catalogo.find((e) => e.clave_normalizada === clave) ?? null
}

/** MO-03 — Cobertura del grupo en una muestra: Σ cobertura de las filas válidas del grupo (0 si no hay). */
export function coberturaGrupo(muestra: MuestraEntrada, grupoId: string, grupoSueloDesnudoId: string): number {
  return muestra.filas
    .filter((f) => filaValida(f) && grupoDeFila(f, grupoSueloDesnudoId) === grupoId)
    .reduce((s, f) => s + (f.cobertura_pct as number), 0)
}

/** MO-04 — Muestras con datos: las que tienen al menos una fila válida. N es su cantidad. */
export function muestrasConDatos<T extends MuestraEntrada>(muestras: T[]): T[] {
  return muestras.filter((m) => m.filas.some(filaValida))
}

export interface ResumenGrupo {
  grupo_id: string
  n: number
  /** cob(m, g) de cada muestra con datos. */
  coberturas: number[]
  promedio: number
  /** Desvío estándar muestral. Nulo si N = 1 (se muestra "—"). */
  desvio: number | null
}

/**
 * MO-05 — Resumen por grupo para un relevamiento y un potrero: promedio = Σ cob / N; desvío
 * estándar muestral (divisor N − 1). Sin resumen (null) si N = 0; desvío nulo si N = 1.
 */
export function resumenGrupo(muestras: MuestraEntrada[], grupoId: string, grupoSueloDesnudoId: string): ResumenGrupo | null {
  const conDatos = muestrasConDatos(muestras)
  const n = conDatos.length
  if (n === 0) return null
  const coberturas = conDatos.map((m) => coberturaGrupo(m, grupoId, grupoSueloDesnudoId))
  const promedio = coberturas.reduce((s, x) => s + x, 0) / n
  const desvio = n === 1 ? null : Math.sqrt(coberturas.reduce((s, x) => s + (x - promedio) ** 2, 0) / (n - 1))
  return { grupo_id: grupoId, n, coberturas, promedio, desvio }
}

/** MO-05 — Resumen de todos los grupos de un potrero en un relevamiento. Null si N = 0. */
export function resumenPotrero(muestras: MuestraEntrada[], grupoIds: string[], grupoSueloDesnudoId: string): ResumenGrupo[] | null {
  if (muestrasConDatos(muestras).length === 0) return null
  return grupoIds.map((g) => resumenGrupo(muestras, g, grupoSueloDesnudoId) as ResumenGrupo)
}

/**
 * MO-06 — Suma de la muestra: Σ cobertura de sus filas válidas. Si |suma − 100| > tolerancia
 * (por defecto 5) se emite AL-10. Es un aviso: no impide guardar.
 */
export function sumaMuestra(muestra: MuestraEntrada, tolerancia = 5): { suma: number; alerta: Alerta | null } {
  const validas = muestra.filas.filter(filaValida)
  const suma = validas.reduce((s, f) => s + (f.cobertura_pct as number), 0)
  return { suma, alerta: validas.length > 0 ? alertaAL10(suma, tolerancia) : null }
}

export interface PuntoEvolucion {
  fecha: Fecha
  n: number
  promedio: number
  desvio: number | null
}

/**
 * MO-07 — Evolución: serie de promedios de un grupo para un potrero, ordenada por fecha de
 * relevamiento. Los relevamientos sin muestras con datos no aportan punto.
 */
export function evolucion(
  relevamientos: { fecha: Fecha; muestras: MuestraEntrada[] }[],
  grupoId: string,
  grupoSueloDesnudoId: string,
): PuntoEvolucion[] {
  return [...relevamientos]
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
    .flatMap((r) => {
      const res = resumenGrupo(r.muestras, grupoId, grupoSueloDesnudoId)
      return res ? [{ fecha: r.fecha, n: res.n, promedio: res.promedio, desvio: res.desvio }] : []
    })
}
