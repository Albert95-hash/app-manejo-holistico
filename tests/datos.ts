// Datos de base de los casos de prueba (SPEC 7.1) y utilidades comunes de los tests.
import { expect } from 'vitest'
import type { FilaComposicion, FilaRodeo } from '../src/motor'
import { mesesPlan } from '../src/motor'

/** Tolerancia de 7.0: ±0.01 en valores con decimales. */
export const TOL = 0.01

/** Compara con la tolerancia de 7.0. Usa expect.soft para informar todas las diferencias del caso. */
export function cerca(actual: number | null | undefined, esperado: number, etiqueta = ''): void {
  expect.soft(typeof actual === 'number' && Number.isFinite(actual), `${etiqueta}: no es un número (${actual})`).toBe(true)
  const dif = Math.abs((actual as number) - esperado)
  expect.soft(dif <= TOL + 1e-9, `${etiqueta}: esperado ${esperado} ± ${TOL}, calculado ${actual}`).toBe(true)
}

// Rodeo R1: OV madre 120 × 0.16; Cordero 70 × 0.08.
export const R1: FilaRodeo[] = [
  { cantidad: 120, ev_unitario: 0.16 },
  { cantidad: 70, ev_unitario: 0.08 },
]

// Rodeo R2: OV madre 122 × 0.8; Vaca Vc 28 × 0.63; Ternero 28 × 0.76; Toro 3 × 1.15.
export const R2: FilaRodeo[] = [
  { cantidad: 122, ev_unitario: 0.8 },
  { cantidad: 28, ev_unitario: 0.63 },
  { cantidad: 28, ev_unitario: 0.76 },
  { cantidad: 3, ev_unitario: 1.15 },
]

/** Composición con el mismo rodeo todos los meses del plan, salvo los indicados en `excepciones`. */
export function composicion(
  inicio: string,
  fin: string,
  rodeo: FilaRodeo[],
  excepciones: Record<string, FilaRodeo[]> = {},
): FilaComposicion[] {
  return mesesPlan(inicio, fin).flatMap((m) => (excepciones[m.mes] ?? rodeo).map((f) => ({ ...f, mes: m.mes })))
}

// Potreros A (plan abierto), en orden de secuencia.
const A: [string, number, number][] = [
  ['discordia', 7, 10],
  ['pitranto', 6, 7],
  ['chacrita', 12.7, 5],
  ['R.Ovejas 1', 27.4, 2],
  ['P. Mosquetas', 13.5, 5],
  ['P. Pasto (Tio)', 5.44, 7],
  ['P. Casa', 4.6, 3],
  ['P. Compañero', 0.5, 9],
  ['P. Pasto (victor)', 2.9, 10],
  ['mallin', 17.5, 6],
  ['puesto palma', 40, 5],
  ['P. Mosquetas victor', 7, 6],
]
export const potrerosA = A.map(([nombre, superficie_ha, calidad], i) => ({
  potrero_id: nombre,
  nombre,
  orden: i + 1,
  superficie_ha,
  calidad,
}))

// Potreros C (plan cerrado), en orden de secuencia.
const C: [string, number, number][] = [
  ['2', 14, 2300],
  ['1', 15, 3100],
  ['6', 17, 1400],
  ['5', 18, 1150],
  ['8', 10, 1600],
  ['12', 8, 450],
  ['11', 10, 350],
  ['discordia', 7, 2000],
  ['mallin', 17.5, 0],
  ['puesto palma', 40, 0],
  ['3', 13, 1600],
  ['18', 16, 3000],
  ['17', 15.5, 2200],
  ['19', 15, 3300],
  ['7', 8, 8000],
  ['13', 9, 3600],
  ['14', 9, 2600],
  ['15', 11.5, 3600],
  ['16', 11, 2500],
]
export const potrerosC = C.map(([nombre, superficie_ha, disponibilidad], i) => ({
  potrero_id: nombre,
  nombre,
  orden: i + 1,
  superficie_ha,
  disponibilidad,
}))

// Plan abierto de 7.3.
export const ABIERTO = { inicio: '2026-11-01', fin: '2027-04-29', tr_min: 60, tr_max: 120, dias: 180 }
// Plan cerrado de 7.4.
export const CERRADO = { inicio: '2027-05-01', fin: '2027-10-27', asignacion: 20, dias: 180 }

// Tabla de equivalencias inicial (SPEC 5.2).
export const EQUIVALENCIAS_INICIALES = [
  { categoria_id: 'OV madre', estado_fisiologico: 'mantenimiento', peso_min_kg: 35, peso_max_kg: 45, ev: 0.16 },
  { categoria_id: 'Cordero', estado_fisiologico: 'mantenimiento', peso_min_kg: 5, peso_max_kg: 15, ev: 0.08 },
]
