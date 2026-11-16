// SPEC 7.7 — Mapa: TC-70 a TC-79.
import { describe, expect, it } from 'vitest'
import { calcularPlanAbierto, calcularPlanCerrado, etiquetaPotrero, tasaVigente, type ModoRecuperacion, type TasaCrecimiento } from '../src/motor'
import { ABIERTO, CERRADO, potrerosA, potrerosC } from './datos'

function abierto(nombre: string, modo: ModoRecuperacion, tasa?: TasaCrecimiento, manual: { tp_min_manual?: number } = {}) {
  const potreros = potrerosA.map((p) => (p.nombre === nombre ? { ...p, ...manual } : p))
  const f = calcularPlanAbierto({ potreros, tr_min: ABIERTO.tr_min, tr_max: ABIERTO.tr_max, modo }).filas.find((x) => x.nombre === nombre)!
  return etiquetaPotrero(f.nombre, f.superficie_ha, { tipo: 'abierto', tp_min: f.tp_min, tp_max: f.tp_max, tasa })
}

function cerrado(nombre: string, dias_reserva: number, selecciones: number) {
  const f = calcularPlanCerrado({ potreros: potrerosC, asignacion: CERRADO.asignacion, selecciones, dias_plan: CERRADO.dias, dias_reserva }).filas.find(
    (x) => x.nombre === nombre,
  )!
  return etiquetaPotrero(f.nombre, f.superficie_ha, { tipo: 'cerrado', dat: f.dat, tp_sel: f.tp_sel, selecciones })
}

describe('7.7 Mapa', () => {
  it('TC-70 (MP-01) plan abierto garantizada, discordia', () => {
    expect(abierto('discordia', 'garantizada').texto).toBe('discordia · 7.00 ha · 8–16 d')
  })

  it('TC-71 (MP-01) plan abierto garantizada, puesto palma', () => {
    expect(abierto('puesto palma', 'garantizada').texto).toBe('puesto palma · 40.00 ha · 23–46 d')
  })

  it('TC-72 (MP-01) plan abierto garantizada, P. Compañero', () => {
    expect(abierto('P. Compañero', 'garantizada').texto).toBe('P. Compañero · 0.50 ha · 1–2 d')
  })

  it('TC-73 (MP-01) plan abierto curso, P. Compañero', () => {
    expect(abierto('P. Compañero', 'curso').texto).toBe('P. Compañero · 0.50 ha · 0.5–1 d')
  })

  it('TC-74 (MP-01) tasa vigente lenta, discordia: se resalta el 16', () => {
    const tasa = tasaVigente([{ fecha_desde: '2026-11-20', tasa: 'lenta' }], '2026-12-01')
    const e = abierto('discordia', 'garantizada', tasa)
    expect(e.texto).toBe('discordia · 7.00 ha · 8–16 d')
    expect([e.resaltado, e.valor_resaltado]).toEqual(['max', '16'])
  })

  it('TC-75 (MP-01) plan cerrado, reserva 0, s = 1, potrero "2"', () => {
    expect(cerrado('2', 0, 1).texto).toBe('2 · 14.00 ha · 12 d')
  })

  it('TC-76 (MP-01) plan cerrado, reserva 15, s = 2, potrero "2"', () => {
    expect(cerrado('2', 15, 2).texto).toBe('2 · 14.00 ha · 7 d × 2')
  })

  it('TC-77 (MP-01) plan cerrado, mallin', () => {
    expect(cerrado('mallin', 0, 1).texto).toBe('mallin · 17.50 ha · sin pasto cargado')
  })

  it('TC-78 (MP-01) potrero no incluido en el plan elegido', () => {
    expect(etiquetaPotrero('P. Pasto (Tio)', 5.44, null).texto).toBe('P. Pasto (Tio) · 5.44 ha')
  })

  it('TC-79 (MP-01) discordia con tp_min_manual = 6', () => {
    expect(abierto('discordia', 'garantizada', undefined, { tp_min_manual: 6 }).texto).toBe('discordia · 7.00 ha · 6–16 d')
  })
})
